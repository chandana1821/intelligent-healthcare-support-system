from fastapi import APIRouter, Depends

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.schemas import PatientUpload
from app.services.doctor_service import list_available_doctors
from app.utils.time import utc_now

router = APIRouter(tags=["patients"])


@router.post("/upload")
async def upload_patient(payload: PatientUpload, user: dict = Depends(get_current_user)) -> dict:
    doc = payload.model_dump()
    doc["email"] = doc["email"].lower()
    doc["updated_at"] = utc_now()
    result = await get_db().patients.update_one(
        {"email": doc["email"]},
        {"$set": doc, "$setOnInsert": {"created_at": utc_now()}},
        upsert=True,
    )
    return {"status": "stored", "matched": result.matched_count, "upserted_id": str(result.upserted_id) if result.upserted_id else None}


@router.get("/patients")
async def list_patients(user: dict = Depends(require_roles(["doctor", "admin"]))) -> list[dict]:
    records = await get_db().patients.find({}, {"password_hash": 0}).sort("created_at", -1).to_list(200)
    for record in records:
        record["_id"] = str(record["_id"])
    return records


@router.get("/doctors")
async def list_doctors() -> list[dict]:
    return await list_available_doctors()
