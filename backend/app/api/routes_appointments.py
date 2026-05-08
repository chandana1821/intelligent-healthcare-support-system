from datetime import date, datetime, time, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from jose import JWTError, jwt
from pymongo.errors import DuplicateKeyError

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.schemas import AppointmentCreate, AppointmentDemoPayment, AppointmentPaymentVerify, AppointmentUpdate
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

APPOINTMENT_SLOT_OPTIONS = [
    {"value": slot.strftime("%H:%M"), "label": slot.strftime("%I:%M %p").lstrip("0")}
    for slot in sorted(ALLOWED_APPOINTMENT_TIMES)
]


def _validate_appointment_request(payload: AppointmentCreate) -> tuple[datetime, date, time]:
    try:
        appointment_date = date.fromisoformat(payload.date)
        appointment_time = time.fromisoformat(payload.time)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid appointment date or time") from exc

    if appointment_date < date.today():
        raise HTTPException(status_code=400, detail="Appointment date cannot be in the past")
    if appointment_time not in ALLOWED_APPOINTMENT_TIMES:
        raise HTTPException(status_code=400, detail="Appointment time must be between 10:00 AM and 6:00 PM")

    return datetime.combine(appointment_date, appointment_time), appointment_date, appointment_time


def _create_booking_token(payload: dict) -> str:
    settings = get_settings()
    token_payload = {
        **payload,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=20),
    }
    return jwt.encode(token_payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode_booking_token(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=400, detail="Booking session expired or invalid. Please start payment again.") from exc


def _serialize_appointment(record: dict) -> dict:
    record["_id"] = str(record["_id"])
    return record


def _today_bounds() -> tuple[datetime, datetime]:
    today = date.today()
    start = datetime.combine(today, time.min)
    end = start + timedelta(days=1)
    return start, end


def _day_bounds(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min)
    end = start + timedelta(days=1)
    return start, end


def _demo_payments_allowed() -> bool:
    settings = get_settings()
    return settings.environment != "production" or bool(settings.razorpay_key_id and settings.razorpay_key_id.startswith("rzp_test_"))


async def _create_confirmed_appointment(
    booking: dict,
    order_id: str,
    payment_id: str,
    payment_method: str,
    demo_upi_id: str | None = None,
) -> dict:
    scheduled_for = datetime.fromisoformat(booking["scheduled_for"])
    existing_slot = await get_db().appointments.find_one({
        "doctor_email": booking["doctor_email"],
        "scheduled_for": scheduled_for,
        "is_confirmed": True,
        "status": {"$ne": "cancelled"},
    })
    if existing_slot:
        raise HTTPException(status_code=409, detail="This slot was booked before payment completed. Please choose another time.")

    existing_payment = await get_db().appointments.find_one({"razorpay_payment_id": payment_id})
    if existing_payment:
        return {"status": "confirmed", "appointment_id": str(existing_payment["_id"])}

    doc = {
        "patient_id": booking["patient_id"],
        "patient_email": booking["patient_email"],
        "patient_name": booking["patient_name"],
        "doctor_email": booking["doctor_email"],
        "doctor_name": booking["doctor_name"],
        "doctor_department": booking["doctor_department"],
        "scheduled_for": scheduled_for,
        "reason": booking["reason"],
        "amount_inr": booking["amount_inr"],
        "status": "booked",
        "payment_status": "paid",
        "payment_method": payment_method,
        "is_confirmed": True,
        "razorpay_order_id": order_id,
        "razorpay_payment_id": payment_id,
        "payment_verified_at": utc_now(),
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    if demo_upi_id:
        doc["demo_upi_id"] = demo_upi_id

    try:
        insert = await get_db().appointments.insert_one(doc)
    except DuplicateKeyError:
        existing_payment = await get_db().appointments.find_one({"razorpay_payment_id": payment_id})
        if existing_payment:
            return {"status": "confirmed", "appointment_id": str(existing_payment["_id"])}
        raise HTTPException(status_code=409, detail="Appointment could not be created because this payment was already used.")
    return {"status": "confirmed", "appointment_id": str(insert.inserted_id)}


@router.post("")
async def create_appointment(payload: AppointmentCreate, user: dict = Depends(require_roles(["patient"]))) -> dict:
    scheduled_for, appointment_date, appointment_time = _validate_appointment_request(payload)
    doctor = await find_doctor_by_email(payload.doctor_email)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    existing = await get_db().appointments.find_one({
        "doctor_email": doctor["email"],
        "scheduled_for": scheduled_for,
        "is_confirmed": True,
        "status": {"$ne": "cancelled"},
    })
    if existing:
        raise HTTPException(status_code=409, detail="This slot is already booked. Please select another time.")

    amount_inr = await get_appointment_fee_inr()
    receipt = f"appt_{uuid4().hex[:24]}"
    try:
        order = create_razorpay_order(amount_inr, receipt)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not create Razorpay order: {exc}") from exc

    booking_token = _create_booking_token({
        "patient_id": user["_id"],
        "patient_email": user["email"],
        "patient_name": user["name"],
        "doctor_email": doctor["email"],
        "doctor_name": doctor["name"],
        "doctor_department": doctor["department"],
        "date": appointment_date.isoformat(),
        "time": appointment_time.strftime("%H:%M"),
        "scheduled_for": scheduled_for.isoformat(),
        "reason": payload.reason,
        "amount_inr": amount_inr,
        "razorpay_order_id": order["id"],
    })

    return {
        "order": order,
        "booking_token": booking_token,
        "status": "payment_required",
        "message": "Complete Razorpay test payment to confirm this appointment. No appointment is stored until payment succeeds.",
    }


@router.post("/payment/verify")
async def verify_appointment_payment(payload: AppointmentPaymentVerify, user: dict = Depends(require_roles(["patient"]))) -> dict:
    booking = _decode_booking_token(payload.booking_token)
    if booking.get("patient_email") != user["email"]:
        raise HTTPException(status_code=403, detail="Booking session does not belong to this patient")
    if booking.get("razorpay_order_id") != payload.razorpay_order_id:
        raise HTTPException(status_code=400, detail="Payment order does not match appointment")

    if not verify_razorpay_payment(payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature):
        raise HTTPException(status_code=400, detail="Payment verification failed")

    return await _create_confirmed_appointment(
        booking=booking,
        order_id=payload.razorpay_order_id,
        payment_id=payload.razorpay_payment_id,
        payment_method="razorpay",
    )


@router.post("/payment/demo")
async def confirm_demo_upi_payment(payload: AppointmentDemoPayment, user: dict = Depends(require_roles(["patient"]))) -> dict:
    if not _demo_payments_allowed():
        raise HTTPException(status_code=403, detail="Demo UPI payments are disabled in production.")

    demo_upi_id = payload.demo_upi_id.strip()
    if "@" not in demo_upi_id:
        raise HTTPException(status_code=400, detail="Enter a demo UPI ID such as success@demo.")

    booking = _decode_booking_token(payload.booking_token)
    if booking.get("patient_email") != user["email"]:
        raise HTTPException(status_code=403, detail="Booking session does not belong to this patient")
    if booking.get("razorpay_order_id") != payload.razorpay_order_id:
        raise HTTPException(status_code=400, detail="Payment order does not match appointment")

    demo_payment_id = f"demo_pay_{uuid4().hex}"
    return await _create_confirmed_appointment(
        booking=booking,
        order_id=payload.razorpay_order_id,
        payment_id=demo_payment_id,
        payment_method="demo_upi",
        demo_upi_id=demo_upi_id,
    )


@router.get("/availability")
async def appointment_availability(
    doctor_email: str,
    appointment_date: str,
    user: dict = Depends(require_roles(["patient", "doctor", "admin"])),
) -> dict:
    try:
        selected_date = date.fromisoformat(appointment_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid appointment date") from exc

    doctor = await find_doctor_by_email(doctor_email)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    start, end = _day_bounds(selected_date)
    records = await get_db().appointments.find(
        {
            "doctor_email": doctor["email"],
            "scheduled_for": {"$gte": start, "$lt": end},
            "is_confirmed": True,
            "status": {"$ne": "cancelled"},
        },
        {"scheduled_for": 1},
    ).to_list(100)
    booked_times = {record["scheduled_for"].time().strftime("%H:%M") for record in records}

    slots = [
        {
            **slot,
            "is_booked": slot["value"] in booked_times,
            "is_available": slot["value"] not in booked_times,
        }
        for slot in APPOINTMENT_SLOT_OPTIONS
    ]
    return {
        "doctor_email": doctor["email"],
        "date": selected_date.isoformat(),
        "slots": slots,
    }


@router.get("/today")
async def list_today_appointments(user: dict = Depends(require_roles(["doctor", "admin"]))) -> list[dict]:
    start, end = _today_bounds()
    query = {
        "scheduled_for": {"$gte": start, "$lt": end},
        "is_confirmed": True,
        "status": {"$ne": "cancelled"},
    }
    if user["role"] == "doctor":
        query["doctor_email"] = user["email"]
    records = await get_db().appointments.find(query).sort("scheduled_for", 1).to_list(100)
    return [_serialize_appointment(record) for record in records]


@router.get("/upcoming")
async def list_upcoming_appointments(user: dict = Depends(require_roles(["doctor", "admin"]))) -> list[dict]:
    _, today_end = _today_bounds()
    query = {
        "scheduled_for": {"$gte": today_end},
        "is_confirmed": True,
        "status": {"$ne": "cancelled"},
    }
    if user["role"] == "doctor":
        query["doctor_email"] = user["email"]
    records = await get_db().appointments.find(query).sort("scheduled_for", 1).to_list(200)
    return [_serialize_appointment(record) for record in records]


@router.get("")
async def list_appointments(user: dict = Depends(get_current_user)) -> list[dict]:
    query = {}
    if user["role"] == "patient":
        query = {"patient_email": user["email"], "$or": [{"is_confirmed": True}, {"status": "cancelled"}]}
    if user["role"] == "doctor":
        query = {"doctor_email": user["email"], "is_confirmed": True, "status": {"$ne": "cancelled"}}
    records = await get_db().appointments.find(query).sort("scheduled_for", 1).to_list(200)
    return [_serialize_appointment(record) for record in records]


@router.patch("/{appointment_id}")
async def update_appointment(appointment_id: str, payload: AppointmentUpdate, user: dict = Depends(require_roles(["doctor", "admin"]))) -> dict:
    from bson import ObjectId

    update = {"status": payload.status, "updated_at": utc_now()}
    if payload.scheduled_for:
        update["scheduled_for"] = payload.scheduled_for
    result = await get_db().appointments.update_one({"_id": ObjectId(appointment_id)}, {"$set": update})
    return {"updated": result.modified_count}


@router.delete("/{appointment_id}")
async def cancel_appointment(appointment_id: str, user: dict = Depends(require_roles(["doctor", "admin"]))) -> dict:
    from bson import ObjectId
    from bson.errors import InvalidId

    try:
        object_id = ObjectId(appointment_id)
    except InvalidId as exc:
        raise HTTPException(status_code=400, detail="Invalid appointment id") from exc

    query = {"_id": object_id}
    if user["role"] == "doctor":
        query["doctor_email"] = user["email"]

    update = {
        "status": "cancelled",
        "is_confirmed": False,
        "cancelled_at": utc_now(),
        "cancelled_by": user["email"],
        "cancelled_by_role": user["role"],
        "updated_at": utc_now(),
    }
    result = await get_db().appointments.update_one(query, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found or not assigned to this doctor")
    return {"status": "cancelled", "updated": result.modified_count}
