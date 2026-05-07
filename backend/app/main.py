import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    routes_analytics,
    routes_appointments,
    routes_auth,
    routes_chat,
    routes_patients,
    routes_predictions,
    routes_settings,
)

# ✅ FIXED IMPORT
from app.api.routes_doctors import router as doctors_router

from app.core.config import get_settings
from app.core.database import close_mongo_connection, connect_to_mongo

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s"
)

settings = get_settings()

# ✅ Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version="1.0.0"
)

# ✅ CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_origin,
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Startup Event
@app.on_event("startup")
async def startup() -> None:
    await connect_to_mongo()

# ✅ Shutdown Event
@app.on_event("shutdown")
async def shutdown() -> None:
    await close_mongo_connection()

# ✅ Health Check
@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": settings.app_name
    }

# ✅ Include Routers WITHOUT PREFIX
app.include_router(routes_auth.router, prefix=settings.api_v1_prefix)
app.include_router(routes_patients.router, prefix=settings.api_v1_prefix)
app.include_router(routes_predictions.router, prefix=settings.api_v1_prefix)
app.include_router(routes_chat.router, prefix=settings.api_v1_prefix)
app.include_router(routes_appointments.router, prefix=settings.api_v1_prefix)
app.include_router(routes_analytics.router, prefix=settings.api_v1_prefix)
app.include_router(routes_settings.router, prefix=settings.api_v1_prefix)

# ✅ Doctors Router
app.include_router(doctors_router, prefix=settings.api_v1_prefix)
