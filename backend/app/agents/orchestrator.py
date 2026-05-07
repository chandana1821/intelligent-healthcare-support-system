from app.services.analytics_service import get_analytics
from app.services.ml_service import symptom_model
from app.services.rag_service import rag_service


class HealthcareAgentRouter:
    async def route(self, intent: str, payload: dict) -> dict:
        if intent == "symptoms":
            return symptom_model.predict(payload["symptoms"])
        if intent == "analytics":
            return await get_analytics()
        return rag_service.answer(payload["message"])


agent_router = HealthcareAgentRouter()
