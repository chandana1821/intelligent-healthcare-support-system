from app.core.database import get_db


def normalize_doctor(doc: dict) -> dict:
    if not doc:
        return {}
    department = (
        doc.get("department")
        or doc.get("specialization")
        or doc.get("speciality")
        or doc.get("dept")
        or "General"
    )
    name = doc.get("name") or doc.get("doctor_name") or doc.get("full_name") or doc.get("email") or "Doctor"
    email = str(doc.get("email") or "").lower()
    availability_status = doc.get("availability_status") or doc.get("availability") or doc.get("status") or "Available"
    return {
        "_id": str(doc.get("_id", email or name)),
        "name": name,
        "email": email,
        "department": department,
        "specialization": department,
        "experience": doc.get("experience") or doc.get("years_experience"),
        "qualification": doc.get("qualification") or doc.get("qualifications"),
        "consultation_fee": doc.get("consultation_fee") or doc.get("fee") or doc.get("amount_inr"),
        "availability_status": availability_status,
        "phone": doc.get("phone") or doc.get("phone_number") or doc.get("mobile"),
        "profile_image": doc.get("profile_image") or doc.get("profileImage") or doc.get("image") or doc.get("avatar"),
        "label": f"{name} - {department}",
    }


def is_available_doctor(doc: dict) -> bool:
    normalized = normalize_doctor(doc)
    return normalized.get("availability_status", "Available").lower() == "available"


def has_explicit_unavailable_status(doc: dict) -> bool:
    status = doc.get("availability_status") or doc.get("availability") or doc.get("status")
    return str(status or "").strip().lower() in {"unavailable", "on leave"}


async def list_available_doctors() -> list[dict]:
    db = get_db()
    doctors_by_email: dict[str, dict] = {}

    user_doctors = await db.users.find(
        {"role": {"$regex": "^doctors?$", "$options": "i"}},
        {
            "name": 1,
            "doctor_name": 1,
            "full_name": 1,
            "email": 1,
            "department": 1,
            "specialization": 1,
            "speciality": 1,
            "dept": 1,
            "experience": 1,
            "qualification": 1,
            "consultation_fee": 1,
            "availability_status": 1,
            "phone": 1,
            "profile_image": 1,
            "profileImage": 1,
            "phone_number": 1,
            "mobile": 1,
            "years_experience": 1,
            "qualifications": 1,
            "fee": 1,
            "availability": 1,
            "status": 1,
        },
    ).sort("name", 1).to_list(200)

    collection_doctors = await db.doctors.find(
        {"$or": [{"role": {"$exists": False}}, {"role": {"$regex": "^doctors?$", "$options": "i"}}]},
        {
            "name": 1,
            "doctor_name": 1,
            "full_name": 1,
            "email": 1,
            "department": 1,
            "specialization": 1,
            "speciality": 1,
            "dept": 1,
            "experience": 1,
            "qualification": 1,
            "consultation_fee": 1,
            "availability_status": 1,
            "phone": 1,
            "profile_image": 1,
            "profileImage": 1,
            "phone_number": 1,
            "mobile": 1,
            "years_experience": 1,
            "qualifications": 1,
            "fee": 1,
            "availability": 1,
            "status": 1,
        },
    ).sort("name", 1).to_list(200)

    available_doctors = await db.available_doctors.find(
        {},
        {
            "name": 1,
            "doctor_name": 1,
            "full_name": 1,
            "email": 1,
            "department": 1,
            "specialization": 1,
            "speciality": 1,
            "dept": 1,
            "experience": 1,
            "qualification": 1,
            "consultation_fee": 1,
            "availability_status": 1,
            "phone": 1,
            "profile_image": 1,
            "profileImage": 1,
            "phone_number": 1,
            "mobile": 1,
            "years_experience": 1,
            "qualifications": 1,
            "fee": 1,
            "availability": 1,
            "status": 1,
        },
    ).sort("name", 1).to_list(200)

    blocked_emails = {
        str(doc.get("email") or "").lower()
        for doc in user_doctors + collection_doctors + available_doctors
        if doc.get("email") and has_explicit_unavailable_status(doc)
    }

    for doc in user_doctors + collection_doctors + available_doctors:
        normalized = normalize_doctor(doc)
        if normalized["email"] and normalized["email"] not in blocked_emails:
            if is_available_doctor(normalized):
                doctors_by_email[normalized["email"]] = normalized

    return sorted(doctors_by_email.values(), key=lambda item: item["label"].lower())


async def find_doctor_by_email(email: str) -> dict | None:
    db = get_db()
    normalized_email = email.lower()
    candidates = [
        item
        for item in [
            await db.users.find_one({"email": normalized_email, "role": {"$regex": "^doctors?$", "$options": "i"}}),
            await db.doctors.find_one({"email": normalized_email}),
            await db.available_doctors.find_one({"email": normalized_email}),
        ]
        if item
    ]
    if not candidates or any(has_explicit_unavailable_status(item) for item in candidates):
        return None
    doctor = next((item for item in candidates if is_available_doctor(item)), candidates[0])
    if not is_available_doctor(doctor):
        return None
    return normalize_doctor(doctor)
