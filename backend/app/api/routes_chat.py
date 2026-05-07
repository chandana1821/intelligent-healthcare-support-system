from fastapi import APIRouter, Depends, HTTPException

from app.agents.orchestrator import agent_router
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.schemas import ChatRequest, ChatResponse
from app.services.rag import RAGError
from app.utils.time import utc_now

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, user: dict = Depends(get_current_user)) -> ChatResponse:
    try:
        result = await agent_router.route("question", payload.model_dump())
    except RAGError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    await get_db().chat_history.insert_one({
        "patient_id": payload.patient_id or user["_id"],
        "patient_email": user["email"],
        "message": payload.message,
        "answer": result["reply"],
        "sources": result["sources"],
        "created_at": utc_now(),
    })
    return ChatResponse(**result)
