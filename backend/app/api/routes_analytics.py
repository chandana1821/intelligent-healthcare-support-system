from fastapi import APIRouter, Depends

from app.agents.orchestrator import agent_router
from app.core.security import require_roles
from app.models.schemas import AnalyticsResponse

router = APIRouter(tags=["analytics"])


@router.get("/analytics", response_model=AnalyticsResponse)
async def analytics(user: dict = Depends(require_roles(["admin", "doctor"]))) -> AnalyticsResponse:
    return AnalyticsResponse(**await agent_router.route("analytics", {}))
