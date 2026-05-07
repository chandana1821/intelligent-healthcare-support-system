from app.core.database import get_db
from app.utils.time import utc_now

SETTINGS_KEY = "platform"
DEFAULT_APPOINTMENT_FEE_INR = 500


async def get_appointment_fee_inr() -> int:
    settings = await get_db().settings.find_one({"key": SETTINGS_KEY})
    return int(settings.get("appointment_fee_inr", DEFAULT_APPOINTMENT_FEE_INR)) if settings else DEFAULT_APPOINTMENT_FEE_INR


async def update_appointment_fee_inr(amount_inr: int, updated_by: str) -> int:
    await get_db().settings.update_one(
        {"key": SETTINGS_KEY},
        {
            "$set": {
                "appointment_fee_inr": amount_inr,
                "updated_by": updated_by,
                "updated_at": utc_now(),
            },
            "$setOnInsert": {"created_at": utc_now()},
        },
        upsert=True,
    )
    return amount_inr
