from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.security import get_current_user, require_roles
from app.services.settings_service import get_appointment_fee_inr, update_appointment_fee_inr

router = APIRouter(prefix="/settings", tags=["settings"])


class AppointmentFeeUpdate(BaseModel):
    amount_inr: int = Field(ge=1, le=100000)


@router.get("/appointment-fee")
async def appointment_fee(user: dict = Depends(get_current_user)) -> dict:
    return {"amount_inr": await get_appointment_fee_inr(), "currency": "INR"}


@router.patch("/appointment-fee")
async def update_appointment_fee(payload: AppointmentFeeUpdate, user: dict = Depends(require_roles(["admin"]))) -> dict:
    if payload.amount_inr <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero")
    amount = await update_appointment_fee_inr(payload.amount_inr, user["email"])
    return {"amount_inr": amount, "currency": "INR"}
