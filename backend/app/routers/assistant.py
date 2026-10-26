"""The REX assistant chat endpoint.

A thin HTTP wrapper over ``services.assistant.interpret``: the frontend chat
panel posts what the operator said (plus a little context — the open transaction,
the current route) and gets back a reply and, when the message asks for one, a
structured action to execute against the real endpoints.
"""

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.assistant import interpret
from app.services.tts import synthesize

router = APIRouter(tags=["assistant"])


def get_assistant_generate():
    """The intent generator, as a dependency so tests can force the offline path."""
    from app.services.assistant import _default_generate

    return _default_generate()


class AssistantContext(BaseModel):
    route: str | None = None
    focused_transaction_id: str | None = None
    class_filter: int | None = None


class ChatBody(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    locale: str = "en"
    context: AssistantContext = Field(default_factory=AssistantContext)


class SpeakBody(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


@router.post("/assistant/tts")
def speak(body: SpeakBody) -> Response:
    """Speak REX's reply with the ElevenLabs voice. Returns MP3 audio, or 204 when
    no voice is configured — the frontend then uses the browser's own voice."""
    audio = synthesize(body.text)
    if audio is None:
        return Response(status_code=204)
    return Response(content=audio, media_type="audio/mpeg")


@router.post("/assistant/chat")
def chat(
    body: ChatBody,
    db: Session = Depends(get_db),
    generate=Depends(get_assistant_generate),
) -> dict:
    return interpret(
        db,
        body.message,
        locale=body.locale,
        context=body.context.model_dump(),
        generate=generate,
    )
