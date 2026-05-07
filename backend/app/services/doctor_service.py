from app.core.database import get_db


def normalize_doctor(doc: dict) -> dict:
    department = (
        doc.get("department")
        or doc.get("specialization")
        or doc.get("speciality")
        or doc.get("dept")
        or "General"
    )
    name = doc.get("name") or doc.get("doctor_name") or doc.get("full_name") or doc.get("email") or "Doctor"
    email = str(doc.get("email") or "").lower()
    return {
        "_id": str(doc.get("_id", email or name)),
        "name": name,
        "email": email,
        "department": department,
        "specialization": department,
        "label": f"{name} - {department}",
    }


async def list_available_doctors() -> list[dict]:
    db = get_db()
    doctors_by_email: dict[str, dict] = {}

    user_doctors = await db.users.find(
        {"role": {"$regex": "^doctor$", "$options": "i"}},
        {
            "name": 1,
            "doctor_name": 1,
            "full_name": 1,
            "email": 1,
            "department": 1,
            "specialization": 1,
            "speciality": 1,
            "dept": 1,
        },
    ).sort("name", 1).to_list(200)

    collection_doctors = await db.doctors.find(
        {"$or": [{"role": {"$exists": False}}, {"role": {"$regex": "^doctor$", "$options": "i"}}]},
        {
            "name": 1,
            "doctor_name": 1,
            "full_name": 1,
            "email": 1,
            "department": 1,
            "specialization": 1,
            "speciality": 1,
            "dept": 1,
        },
    ).sort("name", 1).to_list(200)

    for doc in user_doctors + collection_doctors:
        normalized = normalize_doctor(doc)
        if normalized["email"]:
            doctors_by_email[normalized["email"]] = normalized

    return sorted(doctors_by_email.values(), key=lambda item: item["label"].lower())


async def find_doctor_by_email(email: str) -> dict | None:
    db = get_db()
    normalized_email = email.lower()
    doctor = await db.users.find_one({"email": normalized_email, "role": "doctor"})
    if not doctor:
        doctor = await db.doctors.find_one({"email": normalized_email})
    return normalize_doctor(doctor) if doctor else None
