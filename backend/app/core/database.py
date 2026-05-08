from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import get_settings


class Mongo:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None


mongo = Mongo()


async def connect_to_mongo() -> None:
    settings = get_settings()
    mongo.client = AsyncIOMotorClient(settings.mongodb_uri)
    mongo.db = mongo.client[settings.mongodb_db]
    await mongo.db.command("ping")
    await ensure_indexes()


async def close_mongo_connection() -> None:
    if mongo.client:
        mongo.client.close()


def get_db() -> AsyncIOMotorDatabase:
    if mongo.db is None:
        raise RuntimeError("MongoDB is not connected")
    return mongo.db


async def ensure_indexes() -> None:
    if mongo.db is None:
        return
    await mongo.db.patients.create_index("email", unique=True)
    await mongo.db.users.create_index("email", unique=True)
    await mongo.db.doctors.create_index("email")
    await mongo.db.available_doctors.create_index("email", unique=True)
    await mongo.db.appointments.create_index([("doctor_email", 1), ("scheduled_for", 1)])
    await mongo.db.appointments.create_index("razorpay_payment_id", unique=True, sparse=True)
    await mongo.db.predictions.create_index([("patient_id", 1), ("created_at", -1)])
    await mongo.db.chat_history.create_index([("patient_id", 1), ("created_at", -1)])
