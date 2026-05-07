from fastapi import APIRouter, Depends

from app.agents.orchestrator import agent_router
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.schemas import ChatRequest, ChatResponse
from app.utils.time import utc_now

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, user: dict = Depends(get_current_user)) -> ChatResponse:
    result = await agent_router.route("question", payload.model_dump())
    await get_db().chat_history.insert_one({
        "patient_id": payload.patient_id or user["_id"],
        "patient_email": user["email"],
        "message": payload.message,
        "answer": result["answer"],
        "sources": result["sources"],
        "created_at": utc_now(),
    })
    return ChatResponse(**result)
