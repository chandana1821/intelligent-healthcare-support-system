from datetime import datetime, time
import hashlib
from pathlib import Path
import pickle
import re
from uuid import uuid4
from zipfile import ZipFile
from xml.etree import ElementTree

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.database import get_db
from app.core.security import hash_password
from app.core.security import require_roles
from app.models.schemas import DoctorAdminUpsert, PatientAdminUpdate
from app.services.doctor_service import normalize_doctor
from app.services.rag import CHUNKS_PATH, INDEX_PATH, VECTORSTORE_DIR, rag_chatbot
from app.utils.time import utc_now

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_roles(["admin"]))])

ROOT = Path(__file__).resolve().parents[2]
UPLOAD_DIR = ROOT / "rag_uploads"
SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".docx"}


def _oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except InvalidId as exc:
        raise HTTPException(status_code=400, detail="Invalid id") from exc


def _serialize(record: dict) -> dict:
    record["_id"] = str(record["_id"])
    return record


def _month_key(value: datetime | None) -> str:
    return value.strftime("%Y-%m") if value else "Unscheduled"


async def _patients() -> list[dict]:
    rows = await get_db().patients.find({}, {"password_hash": 0}).sort("created_at", -1).to_list(500)
    return [_serialize(row) for row in rows]


async def _doctors() -> list[dict]:
    db = get_db()
    projection = {
        "name": 1,
        "doctor_name": 1,
        "full_name": 1,
        "email": 1,
        "phone": 1,
        "phone_number": 1,
        "mobile": 1,
        "department": 1,
        "specialization": 1,
        "speciality": 1,
        "dept": 1,
        "experience": 1,
        "years_experience": 1,
        "qualification": 1,
        "qualifications": 1,
        "consultation_fee": 1,
        "fee": 1,
        "amount_inr": 1,
        "availability_status": 1,
        "availability": 1,
        "status": 1,
        "profile_image": 1,
        "profileImage": 1,
        "image": 1,
        "avatar": 1,
        "role": 1,
        "created_at": 1,
        "updated_at": 1,
    }
    role_query = {"role": {"$regex": "^doctors?$", "$options": "i"}}
    doctors_rows = await db.doctors.find({"$or": [{"role": {"$exists": False}}, role_query]}, projection).sort("name", 1).to_list(500)
    user_rows = await db.users.find(role_query, projection).sort("name", 1).to_list(500)
    available_rows = await db.available_doctors.find({}, projection).sort("name", 1).to_list(500)

    merged: dict[str, dict] = {}
    for source, rows in (("users", user_rows), ("doctors", doctors_rows), ("available_doctors", available_rows)):
        for row in rows:
            normalized = _canonical_doctor(row, source)
            key = normalized["email"] or normalized["_id"]
            if key not in merged or source == "doctors":
                merged[key] = normalized
            if source in {"doctors", "users"}:
                await _sync_available_doctor(normalized)
    return sorted(merged.values(), key=lambda item: item["name"].lower())


async def _appointments(query: dict | None = None) -> list[dict]:
    rows = await get_db().appointments.find(query or {}).sort("scheduled_for", -1).to_list(1000)
    return [_serialize(row) for row in rows]


def _available_doctor_doc(doc: dict) -> dict:
    return {
        "doctor_id": str(doc.get("_id", "")),
        "name": doc["name"],
        "email": doc["email"],
        "phone": doc.get("phone"),
        "department": doc["specialization"],
        "specialization": doc["specialization"],
        "experience": doc.get("experience"),
        "qualification": doc.get("qualification"),
        "consultation_fee": doc.get("consultation_fee", 500),
        "availability_status": doc.get("availability_status", "Available"),
        "profile_image": doc.get("profile_image"),
        "role": "doctor",
        "updated_at": utc_now(),
    }


def _canonical_doctor(doc: dict, source: str = "doctors") -> dict:
    normalized = normalize_doctor(doc)
    return {
        "_id": str(doc.get("_id", normalized.get("email", ""))),
        "source": source,
        "name": normalized.get("name") or "Doctor",
        "email": normalized.get("email") or "",
        "phone": normalized.get("phone"),
        "department": normalized.get("department") or "General",
        "specialization": normalized.get("specialization") or normalized.get("department") or "General",
        "experience": normalized.get("experience"),
        "qualification": normalized.get("qualification"),
        "consultation_fee": normalized.get("consultation_fee") or 500,
        "availability_status": normalized.get("availability_status") or "Available",
        "profile_image": normalized.get("profile_image"),
        "role": "doctor",
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


async def _sync_available_doctor(doc: dict) -> None:
    doc = _canonical_doctor(doc)
    available = doc.get("availability_status", "Available").lower() == "available"
    if not doc.get("email"):
        return
    if not available:
        await get_db().available_doctors.delete_one({"email": doc["email"]})
        return
    await get_db().available_doctors.update_one(
        {"email": doc["email"]},
        {"$set": _available_doctor_doc(doc), "$setOnInsert": {"created_at": utc_now()}},
        upsert=True,
    )


@router.get("/dashboard")
async def dashboard() -> dict:
    db = get_db()
    patients = await db.patients.count_documents({})
    doctors = await db.doctors.count_documents({})
    if doctors == 0:
        doctors = await db.users.count_documents({"role": {"$regex": "^doctors?$", "$options": "i"}})
    appointments = await _appointments()
    cancelled = [item for item in appointments if item.get("status") == "cancelled"]
    paid = [item for item in appointments if item.get("payment_status") == "paid"]
    revenue = sum(int(item.get("amount_inr") or 0) for item in paid)

    growth: dict[str, int] = {}
    patient_rows = await _patients()
    for patient in patient_rows:
        key = _month_key(patient.get("created_at"))
        growth[key] = growth.get(key, 0) + 1

    return {
        "totals": {
            "patients": patients,
            "doctors": doctors,
            "appointments": len(appointments),
            "cancelled": len(cancelled),
            "revenue": revenue,
        },
        "patient_growth": [{"month": key, "patients": value} for key, value in sorted(growth.items())],
    }


@router.get("/patients")
async def list_patients(search: str = "", gender: str = "") -> list[dict]:
    query: dict = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    if gender:
        query["gender"] = {"$regex": f"^{re.escape(gender)}$", "$options": "i"}
    rows = await get_db().patients.find(query, {"password_hash": 0}).sort("created_at", -1).to_list(500)
    return [_serialize(row) for row in rows]


@router.patch("/patients/{patient_id}")
async def update_patient(patient_id: str, payload: PatientAdminUpdate) -> dict:
    data = payload.model_dump(exclude_unset=True, mode="json")
    if "email" in data and data["email"]:
        data["email"] = data["email"].lower()
    data["updated_at"] = utc_now()
    result = await get_db().patients.update_one({"_id": _oid(patient_id)}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"updated": result.modified_count}


@router.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str) -> dict:
    patient = await get_db().patients.find_one({"_id": _oid(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    await get_db().users.delete_one({"email": patient.get("email"), "role": "patient"})
    result = await get_db().patients.delete_one({"_id": patient["_id"]})
    return {"deleted": result.deleted_count}


@router.get("/doctors")
async def list_admin_doctors() -> list[dict]:
    return await _doctors()


@router.post("/doctors")
async def create_doctor(payload: DoctorAdminUpsert) -> dict:
    password = payload.password
    doc = payload.model_dump(exclude={"password"}, mode="json")
    doc["email"] = doc["email"].lower()
    doc["department"] = doc["specialization"]
    doc["role"] = "doctor"
    doc["updated_at"] = utc_now()
    existing_user = await get_db().users.find_one({"email": doc["email"]})
    if not existing_user and not password:
        raise HTTPException(status_code=400, detail="Set a login password for this doctor.")
    result = await get_db().doctors.update_one(
        {"email": doc["email"]},
        {"$set": doc, "$setOnInsert": {"created_at": utc_now()}},
        upsert=True,
    )
    existing = await get_db().doctors.find_one({"email": doc["email"]})
    doc["_id"] = existing["_id"]
    await _sync_available_doctor(doc)
    user_update = {
        "name": doc["name"],
        "email": doc["email"],
        "role": "doctor",
        "specialization": doc["specialization"],
        "department": doc["specialization"],
        "phone": doc.get("phone"),
        "experience": doc.get("experience"),
        "qualification": doc.get("qualification"),
        "consultation_fee": doc.get("consultation_fee"),
        "availability_status": doc.get("availability_status", "Available"),
        "profile_image": doc.get("profile_image"),
        "is_active": True,
        "updated_at": utc_now(),
    }
    if password:
        user_update["password_hash"] = hash_password(password)
    await get_db().users.update_one(
        {"email": doc["email"]},
        {
            "$set": user_update,
            "$setOnInsert": {"created_at": utc_now()},
        },
        upsert=True,
    )
    return {"created": str(result.upserted_id or existing["_id"])}


@router.patch("/doctors/{doctor_id}")
async def update_doctor(doctor_id: str, payload: DoctorAdminUpsert) -> dict:
    db = get_db()
    password = payload.password
    doc = payload.model_dump(exclude={"password"}, mode="json")
    doc["email"] = doc["email"].lower()
    doc["department"] = doc["specialization"]
    doc["role"] = "doctor"
    doc["updated_at"] = utc_now()
    object_id = _oid(doctor_id)
    result = await db.doctors.update_one({"_id": object_id}, {"$set": doc})
    if result.matched_count == 0:
        user = await db.users.find_one({"_id": object_id, "role": {"$regex": "^doctors?$", "$options": "i"}})
        available = await db.available_doctors.find_one({"_id": object_id})
        if not user and not available:
            raise HTTPException(status_code=404, detail="Doctor not found")
        await db.doctors.update_one(
            {"email": doc["email"]},
            {"$set": doc, "$setOnInsert": {"created_at": user.get("created_at") if user else utc_now()}},
            upsert=True,
        )
    saved = await db.doctors.find_one({"email": doc["email"]})
    doc["_id"] = saved["_id"] if saved else doctor_id
    await _sync_available_doctor(doc)
    user_update = {
        "name": doc["name"],
        "email": doc["email"],
        "role": "doctor",
        "specialization": doc["specialization"],
        "department": doc["specialization"],
        "phone": doc.get("phone"),
        "experience": doc.get("experience"),
        "qualification": doc.get("qualification"),
        "consultation_fee": doc.get("consultation_fee"),
        "availability_status": doc.get("availability_status", "Available"),
        "profile_image": doc.get("profile_image"),
        "is_active": True,
        "updated_at": utc_now(),
    }
    if password:
        user_update["password_hash"] = hash_password(password)
    await db.users.update_one(
        {"email": doc["email"]},
        {
            "$set": user_update,
            "$setOnInsert": {"created_at": utc_now()},
        },
        upsert=bool(password),
    )
    return {"updated": result.modified_count}


@router.delete("/doctors/{doctor_id}")
async def delete_doctor(doctor_id: str) -> dict:
    db = get_db()
    object_id = _oid(doctor_id)
    doctor = await db.doctors.find_one({"_id": object_id})
    if not doctor:
        doctor = await db.users.find_one({"_id": object_id, "role": {"$regex": "^doctors?$", "$options": "i"}})
    if not doctor:
        doctor = await db.available_doctors.find_one({"_id": object_id})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    email = str(doctor.get("email") or "").lower()
    await db.users.delete_one({"email": email, "role": {"$regex": "^doctors?$", "$options": "i"}})
    await db.available_doctors.delete_one({"email": email})
    result = await db.doctors.delete_one({"email": email})
    return {"deleted": result.deleted_count}


@router.get("/appointments")
async def list_admin_appointments(
    doctor: str = "",
    patient: str = "",
    status: str = "",
    date: str = "",
) -> list[dict]:
    query: dict = {}
    if doctor:
        query["doctor_email"] = {"$regex": doctor, "$options": "i"}
    if patient:
        query["patient_email"] = {"$regex": patient, "$options": "i"}
    if status:
        query["status"] = status
    if date:
        start = datetime.combine(datetime.fromisoformat(date).date(), time.min)
        end = datetime.combine(datetime.fromisoformat(date).date(), time.max)
        query["scheduled_for"] = {"$gte": start, "$lte": end}
    return await _appointments(query)


@router.get("/revenue")
async def revenue(doctor: str = "", date_from: str = "", date_to: str = "") -> dict:
    query: dict = {}
    if doctor:
        query["doctor_email"] = {"$regex": doctor, "$options": "i"}
    if date_from or date_to:
        query["scheduled_for"] = {}
        if date_from:
            query["scheduled_for"]["$gte"] = datetime.combine(datetime.fromisoformat(date_from).date(), time.min)
        if date_to:
            query["scheduled_for"]["$lte"] = datetime.combine(datetime.fromisoformat(date_to).date(), time.max)

    appointments = await _appointments(query)
    by_doctor: dict[str, dict] = {}
    monthly: dict[str, int] = {}
    payment_split = {"paid": 0, "pending": 0}
    for item in appointments:
        amount = int(item.get("amount_inr") or 0)
        email = item.get("doctor_email") or "unknown"
        bucket = by_doctor.setdefault(email, {"doctor": item.get("doctor_name") or email, "email": email, "earnings": 0, "appointments": 0})
        bucket["appointments"] += 1
        if item.get("payment_status") == "paid":
            bucket["earnings"] += amount
            monthly[_month_key(item.get("scheduled_for"))] = monthly.get(_month_key(item.get("scheduled_for")), 0) + amount
            payment_split["paid"] += 1
        else:
            payment_split["pending"] += 1

    return {
        "doctors": sorted(by_doctor.values(), key=lambda item: item["earnings"], reverse=True),
        "monthly": [{"month": key, "revenue": value} for key, value in sorted(monthly.items())],
        "payments": [{"name": key.title(), "count": value} for key, value in payment_split.items()],
    }


def _read_docx(path: Path) -> str:
    with ZipFile(path) as archive:
        xml = archive.read("word/document.xml")
    root = ElementTree.fromstring(xml)
    return " ".join(node.text or "" for node in root.iter() if node.tag.endswith("}t"))


def _extract_text(path: Path) -> str:
    if path.suffix == ".txt":
        return path.read_text(encoding="utf-8", errors="ignore")
    if path.suffix == ".docx":
        return _read_docx(path)
    if path.suffix == ".pdf":
        try:
            from pypdf import PdfReader
        except Exception as exc:
            raise HTTPException(status_code=500, detail="PDF uploads require pypdf. Install backend dependencies.") from exc
        reader = PdfReader(str(path))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    return ""


def _chunk_text(text: str, size: int = 900, overlap: int = 120) -> list[str]:
    clean = re.sub(r"\s+", " ", text).strip()
    if not clean:
        return []
    chunks = []
    step = max(size - overlap, 1)
    for start in range(0, len(clean), step):
        chunks.append(clean[start:start + size])
    return chunks


def _rebuild_vectorstore(chunks: list[str]) -> int:
    if not chunks:
        raise HTTPException(status_code=400, detail="No readable text found in uploaded document")
    from sentence_transformers import SentenceTransformer
    import faiss
    import numpy as np

    VECTORSTORE_DIR.mkdir(parents=True, exist_ok=True)
    existing = []
    if CHUNKS_PATH.exists():
        with CHUNKS_PATH.open("rb") as file:
            existing = pickle.load(file)
    all_chunks = existing + chunks
    encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    embeddings = np.asarray(encoder.encode(all_chunks, normalize_embeddings=True), dtype="float32")
    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)
    faiss.write_index(index, str(INDEX_PATH))
    with CHUNKS_PATH.open("wb") as file:
        pickle.dump(all_chunks, file)
    rag_chatbot.index = None
    rag_chatbot.chunks = []
    return len(chunks)


def _remove_chunks_from_vectorstore(chunk_hashes: list[str]) -> None:
    if not CHUNKS_PATH.exists() or not INDEX_PATH.exists() or not chunk_hashes:
        return
    with CHUNKS_PATH.open("rb") as file:
        existing = pickle.load(file)
    remove = set(chunk_hashes)
    remaining = [chunk for chunk in existing if hashlib.sha256(chunk.encode("utf-8")).hexdigest() not in remove]
    if not remaining:
        INDEX_PATH.unlink(missing_ok=True)
        CHUNKS_PATH.unlink(missing_ok=True)
        rag_chatbot.index = None
        rag_chatbot.chunks = []
        return
    from sentence_transformers import SentenceTransformer
    import faiss
    import numpy as np

    encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    embeddings = np.asarray(encoder.encode(remaining, normalize_embeddings=True), dtype="float32")
    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)
    faiss.write_index(index, str(INDEX_PATH))
    with CHUNKS_PATH.open("wb") as file:
        pickle.dump(remaining, file)
    rag_chatbot.index = None
    rag_chatbot.chunks = []


@router.post("/rag-documents")
async def upload_rag_document(file: UploadFile = File(...)) -> dict:
    extension = Path(file.filename or "").suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Supported files are PDF, TXT, and DOCX")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid4().hex}{extension}"
    path = UPLOAD_DIR / stored_name
    path.write_bytes(await file.read())
    chunks = _chunk_text(_extract_text(path))
    chunk_count = _rebuild_vectorstore(chunks)
    doc = {
        "filename": file.filename,
        "stored_name": stored_name,
        "content_type": file.content_type,
        "size_bytes": path.stat().st_size,
        "chunk_count": chunk_count,
        "chunk_hashes": [hashlib.sha256(chunk.encode("utf-8")).hexdigest() for chunk in chunks],
        "status": "indexed",
        "created_at": utc_now(),
    }
    result = await get_db().rag_documents.insert_one(doc)
    return {"document_id": str(result.inserted_id), **doc}


@router.get("/rag-documents")
async def list_rag_documents() -> list[dict]:
    rows = await get_db().rag_documents.find({}).sort("created_at", -1).to_list(200)
    return [_serialize(row) for row in rows]


@router.delete("/rag-documents/{document_id}")
async def delete_rag_document(document_id: str) -> dict:
    doc = await get_db().rag_documents.find_one({"_id": _oid(document_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    path = UPLOAD_DIR / doc.get("stored_name", "")
    if path.exists():
        path.unlink()
    _remove_chunks_from_vectorstore(doc.get("chunk_hashes", []))
    result = await get_db().rag_documents.delete_one({"_id": doc["_id"]})
    return {"deleted": result.deleted_count}
