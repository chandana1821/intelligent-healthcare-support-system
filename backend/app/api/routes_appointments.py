from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.schemas import AppointmentCreate, AppointmentPaymentVerify, AppointmentUpdate
from app.services.doctor_service import find_doctor_by_email
from app.services.payment_service import create_razorpay_order, verify_razorpay_payment
from app.services.settings_service import get_appointment_fee_inr
from app.utils.time import utc_now

router = APIRouter(prefix="/appointments", tags=["appointments"])

ALLOWED_APPOINTMENT_TIMES = {
    time(hour, minute)
    for hour in range(10, 19)
    for minute in (0, 30)
    if not (hour == 18 and minute == 30)
}


@router.post("")
async def create_appointment(payload: AppointmentCreate, user: dict = Depends(require_roles(["patient"]))) -> dict:
    try:
        appointment_date = date.fromisoformat(payload.date)
        appointment_time = time.fromisoformat(payload.time)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid appointment date or time") from exc

    if appointment_date < date.today():
        raise HTTPException(status_code=400, detail="Appointment date cannot be in the past")
    if appointment_time not in ALLOWED_APPOINTMENT_TIMES:
        raise HTTPException(status_code=400, detail="Appointment time must be between 10:00 AM and 6:00 PM")

    scheduled_for = datetime.combine(appointment_date, appointment_time)
    doctor = await find_doctor_by_email(payload.doctor_email)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    amount_inr = await get_appointment_fee_inr()
    doc = {
        "patient_id": user["_id"],
        "patient_email": user["email"],
        "patient_name": user["name"],
        "doctor_email": doctor["email"],
        "doctor_name": doctor["name"],
        "doctor_department": doctor["department"],
        "scheduled_for": scheduled_for,
        "reason": payload.reason,
        "amount_inr": amount_inr,
        "status": "payment_pending",
        "is_confirmed": False,
        "created_at": utc_now(),
    }
    insert = await get_db().appointments.insert_one(doc)
    try:
        order = create_razorpay_order(amount_inr, str(insert.inserted_id))
    except Exception as exc:
        await get_db().appointments.update_one(
            {"_id": insert.inserted_id},
            {"$set": {"status": "payment_order_failed", "payment_order_error": str(exc), "updated_at": utc_now()}},
        )
        raise HTTPException(status_code=502, detail=f"Could not create Razorpay order: {exc}") from exc
    await get_db().appointments.update_one({"_id": insert.inserted_id}, {"$set": {"razorpay_order": order}})
    return {
        "appointment_id": str(insert.inserted_id),
        "order": order,
        "status": "payment_pending",
        "message": "Complete Razorpay payment to confirm this appointment.",
    }


@router.post("/payment/verify")
async def verify_appointment_payment(payload: AppointmentPaymentVerify, user: dict = Depends(require_roles(["patient"]))) -> dict:
    from bson import ObjectId

    appointment = await get_db().appointments.find_one({"_id": ObjectId(payload.appointment_id), "patient_email": user["email"]})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    stored_order_id = appointment.get("razorpay_order", {}).get("id")
    if stored_order_id != payload.razorpay_order_id:
        raise HTTPException(status_code=400, detail="Payment order does not match appointment")

    if not verify_razorpay_payment(payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature):
        await get_db().appointments.update_one(
            {"_id": ObjectId(payload.appointment_id)},
            {"$set": {"status": "payment_failed", "is_confirmed": False, "payment_failed_at": utc_now()}},
        )
        raise HTTPException(status_code=400, detail="Payment verification failed")

    await get_db().appointments.update_one(
        {"_id": ObjectId(payload.appointment_id)},
        {
            "$set": {
                "status": "confirmed",
                "is_confirmed": True,
                "razorpay_payment_id": payload.razorpay_payment_id,
                "payment_verified_at": utc_now(),
                "updated_at": utc_now(),
            }
        },
    )
    return {"status": "confirmed", "appointment_id": payload.appointment_id}


@router.get("")
async def list_appointments(user: dict = Depends(get_current_user)) -> list[dict]:
    query = {}
    if user["role"] == "patient":
        query = {"patient_email": user["email"]}
    if user["role"] == "doctor":
        query = {"doctor_email": user["email"]}
    records = await get_db().appointments.find(query).sort("scheduled_for", 1).to_list(200)
    for record in records:
        record["_id"] = str(record["_id"])
    return records


@router.patch("/{appointment_id}")
async def update_appointment(appointment_id: str, payload: AppointmentUpdate, user: dict = Depends(require_roles(["doctor", "admin"]))) -> dict:
    from bson import ObjectId

    update = {"status": payload.status, "updated_at": utc_now()}
    if payload.scheduled_for:
        update["scheduled_for"] = payload.scheduled_for
    result = await get_db().appointments.update_one({"_id": ObjectId(appointment_id)}, {"$set": update})
    return {"updated": result.modified_count}
