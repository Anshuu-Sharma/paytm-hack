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
from app.services.call_drafting import continue_call, start_call
from app.services.campaign_drafting import draft_campaign
from app.services.sarvam_tts import synthesize

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
    locale: str = "hi"


class CampaignTurnBody(BaseModel):
    role: str
    text: str


class CampaignChatBody(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    locale: str = "hi"
    history: list[CampaignTurnBody] = Field(default_factory=list)
    template: dict | None = None
    audience: str | None = None


class CallStartBody(BaseModel):
    customer_name: str = Field(min_length=1, max_length=200)
    reason: str = "late_payment"
    custom_reason: str | None = None
    locale: str = "hi"


class CallTurnBody(BaseModel):
    role: str
    text: str


class CallChatBody(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    customer_name: str = Field(min_length=1, max_length=200)
    reason: str = "late_payment"
    custom_reason: str | None = None
    locale: str = "hi"
    history: list[CallTurnBody] = Field(default_factory=list)


@router.post("/assistant/tts")
def speak(body: SpeakBody) -> Response:
    """Speak REX's reply with the Sarvam Bulbul voice. Returns MP3 audio, or 204 when
    no voice is configured — the frontend then uses the browser's own voice."""
    lang = "hi-IN" if body.locale.startswith("hi") else "en-IN"
    audio = synthesize(body.text, language_code=lang)
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


@router.post("/assistant/campaign-chat")
def campaign_chat(body: CampaignChatBody) -> dict:
    """One turn of the WhatsApp "Voice Help" campaign-drafting conversation.

    Stateless by design — the frontend carries the running transcript and the
    current template back on every turn, since this is a short-lived voice
    session with no persisted campaign record (yet) on the backend.
    """
    return draft_campaign(
        body.message,
        history=[t.model_dump() for t in body.history],
        template=body.template,
        audience=body.audience,  # type: ignore[arg-type]
        locale=body.locale,
    )


@router.post("/assistant/call-start")
def call_start(body: CallStartBody) -> dict:
    """REX's opening line for a simulated outbound "Call Customer" call."""
    return start_call(
        body.customer_name,
        body.reason,
        body.custom_reason,
        locale=body.locale,
    )


@router.post("/assistant/call-chat")
def call_chat(body: CallChatBody) -> dict:
    """One turn of the simulated outbound call, after REX's opening line.

    Stateless like ``campaign-chat`` — the frontend carries the running
    transcript back on every turn; there's no persisted call record for this
    demo feature (it targets the dummy customer directory, not a real
    transaction).
    """
    return continue_call(
        body.message,
        customer_name=body.customer_name,
        reason_key=body.reason,
        custom_reason=body.custom_reason,
        history=[t.model_dump() for t in body.history],
        locale=body.locale,
    )
