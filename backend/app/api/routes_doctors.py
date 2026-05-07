from fastapi import APIRouter, HTTPException
from app.services.doctor_service import list_available_doctors

router = APIRouter(
    prefix="/doctors",
    tags=["doctors"],
    dependencies=[]   # 🔥 FORCE NO AUTH
)

@router.get("/")
async def get_doctors():
    try:
        return await list_available_doctors()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not load doctors: {exc}") from exc


@router.get("")
async def get_doctors_without_slash():
    try:
        return await list_available_doctors()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not load doctors: {exc}") from exc
