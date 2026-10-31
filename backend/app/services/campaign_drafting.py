"""AI-assisted WhatsApp campaign drafting for REX's voice "Campaign Help" mode.

Turns a merchant's spoken instruction ("send all customers a Diwali greeting")
into a structured WhatsApp campaign template, asks who it should go to if the
merchant hasn't said, then revises it conversationally (add a discount, change
the tone) until the merchant confirms it should send. Gemini drives the loop in
JSON mode, mirroring the diagnosis engine's approach; if the model is
unavailable the engine degrades to a fixed template + keyword audience parser
so the voice demo always has something to show and speak.
"""

from __future__ import annotations

import json
import logging
from typing import Callable, Literal, TypedDict

logger = logging.getLogger(__name__)

GenerateFn = Callable[[str], str]

Audience = Literal["all", "dormant", "vip", "custom"]

AUDIENCE_LABEL_EN: dict[Audience, str] = {
    "all": "all customers",
    "dormant": "dormant customers",
    "vip": "your VIP / top spenders",
    "custom": "that custom segment",
}
AUDIENCE_LABEL_HI: dict[Audience, str] = {
    "all": "sabhi customers",
    "dormant": "dormant customers",
    "vip": "VIP customers",
    "custom": "us custom segment",
}


class CampaignTemplate(TypedDict):
    headline: str
    body: str
    discount: str | None


class CampaignDraft(TypedDict):
    reply_text: str
    template: CampaignTemplate
    audience: Audience | None
    ready_to_send: bool


def _parse_audience(text: str) -> Audience | None:
    t = text.lower()
    if any(w in t for w in ("vip", "top spender", "top customer", "best customer")):
        return "vip"
    if any(w in t for w in ("dormant", "inactive", "silent", "churned")):
        return "dormant"
    if any(w in t for w in ("custom segment", "specific segment", "particular group")):
        return "custom"
    if any(w in t for w in ("sabhi", "sab customer", "sab ko", "all customer", "everyone", "everybody")):
        return "all"
    return None


def _fallback(
    message: str,
    template: CampaignTemplate | None,
    audience: Audience | None,
    locale: str,
) -> CampaignDraft:
    hi = locale.startswith("hi")
    wants_send = any(w in message.lower() for w in ("send", "bhej", "confirm", "go ahead", "haan bhej"))
    wants_discount = "discount" in message.lower() or "chhoot" in message.lower() or "offer" in message.lower()

    base = template or {
        "headline": "दिवाली धमाका 🎉" if hi else "Diwali Dhamaka 🎉",
        "body": (
            "नमस्ते {name}! REX की तरफ़ से दिवाली की हार्दिक शुभकामनाएँ। "
            "आपके लिए एक खास ऑफर तैयार है।"
            if hi
            else "Hi {name}! Wishing you a very Happy Diwali from all of us. "
            "We've got something special for you."
        ),
        "discount": None,
    }
    if wants_discount and not base.get("discount"):
        base = {**base, "discount": "10% off on your next order — use code DIWALI10"}

    final_audience = _parse_audience(message) or audience

    if wants_send:
        if not final_audience:
            reply = (
                "Pehle batao kis audience ko bhejna hai — sabhi customers, dormant, ya VIP?"
                if hi
                else "Who should this go to — all customers, dormant customers, or your VIP segment?"
            )
            return {"reply_text": reply, "template": base, "audience": None, "ready_to_send": False}
        label = (AUDIENCE_LABEL_HI if hi else AUDIENCE_LABEL_EN)[final_audience]
        reply = f"Theek hai, {label} ko bhej diya gaya." if hi else f"Done — sending this to {label} now."
        return {"reply_text": reply, "template": base, "audience": final_audience, "ready_to_send": True}

    if final_audience and final_audience != audience:
        label = (AUDIENCE_LABEL_HI if hi else AUDIENCE_LABEL_EN)[final_audience]
        reply = (
            f"Theek hai, {label} ke liye set kar diya. Bhejna shuru karu?"
            if hi
            else f"Got it — targeting {label}. Want me to send it?"
        )
        return {"reply_text": reply, "template": base, "audience": final_audience, "ready_to_send": False}

    reply = (
        "Yeh ek sample Diwali template hai. Discount add karna hai, ya batao kis audience ko bhejna hai?"
        if hi
        else "Here's a sample Diwali template. Want to add a discount, or tell me who to send it to?"
    )
    return {"reply_text": reply, "template": base, "audience": final_audience, "ready_to_send": False}


def draft_campaign(
    message: str,
    *,
    history: list[dict] | None = None,
    template: CampaignTemplate | None = None,
    audience: Audience | None = None,
    locale: str = "hi",
    generate: GenerateFn | None = None,
) -> CampaignDraft:
    history = history or []
    convo = "\n".join(f"{t.get('role', '?')}: {t.get('text', '')}" for t in history[-8:])
    current_template = json.dumps(template) if template else "(none yet)"
    current_audience = audience or "(not chosen yet)"
    prompt = (
        "You are REX, an AI that drafts and sends WhatsApp marketing campaigns for a Paytm "
        "merchant, talking to the merchant over voice in Hinglish.\n"
        f"Conversation so far:\n{convo or '(none yet)'}\n"
        f"Current draft template (JSON, may be empty): {current_template}\n"
        f"Current chosen audience: {current_audience}\n"
        f"Merchant just said: {message!r}\n\n"
        "Respond with ONLY JSON of this exact shape:\n"
        '{"reply_text": "<one short spoken reply, Hinglish, at most 2 sentences>", '
        '"template": {"headline": "<short headline with an emoji>", '
        '"body": "<WhatsApp message body, use {name} as the customer name placeholder>", '
        '"discount": "<short discount/offer line, or null>"}, '
        '"audience": "<one of \\"all\\", \\"dormant\\", \\"vip\\", \\"custom\\", or null if not decided yet>", '
        '"ready_to_send": <true ONLY if the merchant explicitly confirmed sending AND an audience is chosen>}\n'
        "Rules: always include a template (create one on the first turn, revise it on later turns, never "
        "null). If the merchant asks for a discount or any addition, fold it into the template body and set "
        "the discount field. If no audience is chosen yet and the merchant hasn't just told you one, ask who "
        "it should go to (all customers / dormant customers / VIP top spenders / a custom segment) before you "
        "ever set ready_to_send true — do not assume 'all' by default. Map whatever the merchant says about "
        "recipients to one of those four audience values. Keep the body under 3 sentences."
    )

    gen = generate or _default_generate()
    if gen is not None:
        try:
            raw = gen(prompt)
            data = json.loads(raw)
            if isinstance(data, dict) and isinstance(data.get("template"), dict) and "reply_text" in data:
                data.setdefault("audience", audience)
                data.setdefault("ready_to_send", False)
                if data["ready_to_send"] and not data.get("audience"):
                    data["ready_to_send"] = False
                return data  # type: ignore[return-value]
        except Exception as exc:  # any SDK/network/parse error → template
            logger.warning("Campaign draft generation failed (%s); using template.", exc)

    return _fallback(message, template, audience, locale)


def _default_generate() -> GenerateFn | None:
    """Build the live JSON generator lazily; None if the SDK can't be wired."""
    try:
        from app.services.gemini_client import build_generate

        return build_generate()
    except Exception:  # pragma: no cover - import/SDK issues fall back to template
        return None
