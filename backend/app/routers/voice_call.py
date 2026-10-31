"""WebSocket endpoint for live voice recovery calls powered by Sarvam AI."""

from fastapi import APIRouter, Depends, WebSocket
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.sarvam_voice_agent import handle_voice_call_session

router = APIRouter(tags=["voice-call"])


@router.websocket("/voice-call/{transaction_id}")
async def live_voice_call(
    websocket: WebSocket,
    transaction_id: str,
    db: Session = Depends(get_db),
):
    await handle_voice_call_session(websocket, transaction_id, db)

