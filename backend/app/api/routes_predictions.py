from fastapi import APIRouter, Depends

from app.agents.orchestrator import agent_router
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.schemas import PredictRequest, PredictResponse
from app.utils.time import utc_now

router = APIRouter(tags=["prediction"])


@router.post("/predict", response_model=PredictResponse)
async def predict(payload: PredictRequest, user: dict = Depends(get_current_user)) -> PredictResponse:
    result = await agent_router.route("symptoms", payload.model_dump())
    await get_db().predictions.insert_one({
        "patient_id": payload.patient_id or user["_id"],
        "patient_email": user["email"],
        "symptoms": payload.symptoms,
        "disease": result["disease"],
        "urgency": result["urgency"],
        "confidence": result["confidence"],
        "created_at": utc_now(),
    })
    return PredictResponse(**result)


@router.get("/symptoms")
async def symptoms() -> dict:
    from app.services.ml_service import symptom_model

    return {"symptoms": symptom_model.symptoms}
