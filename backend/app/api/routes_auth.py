from fastapi import APIRouter, HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.schemas import LoginRequest, RegisterRequest, Role, TokenResponse
from app.utils.time import utc_now

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(payload: RegisterRequest) -> TokenResponse:
    settings = get_settings()
    db = get_db()
    email = payload.email.lower()
    if payload.role in {Role.doctor, Role.admin} and not email.endswith(f"@{settings.staff_email_domain}"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Staff accounts require company domain email")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user_doc = payload.model_dump(exclude={"password"}, mode="json")
    user_doc.update({"email": email, "password_hash": hash_password(payload.password), "created_at": utc_now(), "is_active": True})
    try:
        await db.users.insert_one(user_doc)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered") from exc
    if payload.role == Role.patient:
        await db.patients.update_one(
            {"email": email},
            {"$setOnInsert": {"name": payload.name, "email": email, "phone": payload.phone, "age": payload.age, "gender": payload.gender, "created_at": utc_now()}},
            upsert=True,
        )
    token = create_access_token(email, payload.role.value)
    return TokenResponse(access_token=token, role=payload.role, name=payload.name)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest) -> TokenResponse:
    user = await get_db().users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token(user["email"], user["role"])
    return TokenResponse(access_token=token, role=user["role"], name=user["name"])
