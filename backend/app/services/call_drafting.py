"""AI-voiced "Call Customer" simulation for the Call Customer feature.

The merchant picks a customer and a reason (late payment, missed subscription,
etc.) and REX places a simulated outbound call: REX speaks first, the merchant
plays the customer's part over the mic, and REX replies turn by turn until the
call naturally wraps up. Stateless REST, mirroring ``campaign_drafting.py`` —
Gemini drives the loop in JSON mode when available; otherwise a short scripted
exchange per reason keeps the demo working without a live model.
"""

from __future__ import annotations

import json
import logging
from typing import Callable, TypedDict

logger = logging.getLogger(__name__)

GenerateFn = Callable[[str], str]

REASON_CONTEXT: dict[str, str] = {
    "late_payment": "a payment that is overdue and needs a gentle reminder",
    "failed_payment": "a recent transaction that failed and needs to be retried or resolved",
    "missed_subscription": "a subscription auto-debit that was missed and needs to be restarted",
    "win_back": "the customer having gone quiet for a while — a friendly win-back check-in",
    "custom": "",  # the merchant's own free-text reason is used verbatim
}

REASON_OPENING_HI: dict[str, str] = {
    "late_payment": "Namaste {name} ji! Main REX bol raha hoon, {merchant} ki taraf se. Aapka ek payment pending hai, isi silsile mein call kiya tha.",
    "failed_payment": "Namaste {name} ji! Main REX, {merchant} ki taraf se bol raha hoon. Aapka ek recent transaction fail ho gaya tha, isiliye call kiya.",
    "missed_subscription": "Namaste {name} ji! Main REX bol raha hoon. Aapka subscription renewal is baar miss ho gaya, bas isi baare mein baat karni thi.",
    "win_back": "Namaste {name} ji! Main REX, {merchant} ki taraf se. Kaafi din ho gaye aapko dekhe hue, bas haal-chaal lene ke liye call kiya.",
}


class CallTurnResult(TypedDict):
    reply_text: str
    call_ended: bool


def _unwrap_stray_json(text: str) -> str:
    """Defensive guard: some Gemini configs wrap "plain text" output as JSON
    (e.g. ``{"opening_line": "..."}``) despite being asked not to. If this
    looks like that, pull the actual line back out instead of speaking the
    raw JSON."""
    if not (text.startswith("{") and text.endswith("}")):
        return text
    try:
        data = json.loads(text)
    except Exception:
        return text
    if isinstance(data, dict) and len(data) == 1:
        value = next(iter(data.values()))
        if isinstance(value, str) and value.strip():
            return value.strip()
    return text


def start_call(
    customer_name: str,
    reason_key: str,
    custom_reason: str | None,
    *,
    merchant: str = "Sharma Supermarket",
    locale: str = "hi",
    generate: GenerateFn | None = None,
) -> CallTurnResult:
    first = customer_name.split(" ")[0]
    reason_desc = custom_reason.strip() if reason_key == "custom" and custom_reason else REASON_CONTEXT.get(reason_key, "a general check-in")

    gen = generate or _default_text_generate()
    if gen is not None:
        prompt = (
            "You are REX, an AI voice agent placing an outbound phone call on behalf of a Paytm "
            f"merchant called {merchant!r}, speaking Hinglish.\n"
            f"You are calling the customer {customer_name!r} about: {reason_desc}.\n"
            "Write ONLY the opening line REX says the moment the customer picks up: greet them by "
            "first name, say who you are and which business you're calling from, then briefly state "
            "why you're calling. At most 2 short sentences. Plain text only — no JSON, no preamble, "
            "no quotes — just the line itself."
        )
        try:
            text = gen(prompt).strip().strip('"')
            text = _unwrap_stray_json(text)
            if text:
                return {"reply_text": text, "call_ended": False}
        except Exception as exc:  # pragma: no cover
            logger.warning("Call opening generation failed (%s); using template.", exc)

    template = REASON_OPENING_HI.get(reason_key)
    if template:
        return {"reply_text": template.format(name=first, merchant=merchant), "call_ended": False}
    return {
        "reply_text": f"Namaste {first} ji! Main REX bol raha hoon, {merchant} ki taraf se. {reason_desc} ke baare mein baat karni thi.",
        "call_ended": False,
    }


def continue_call(
    message: str,
    *,
    customer_name: str,
    reason_key: str,
    custom_reason: str | None,
    history: list[dict] | None = None,
    merchant: str = "Sharma Supermarket",
    locale: str = "hi",
    generate: GenerateFn | None = None,
) -> CallTurnResult:
    history = history or []
    first = customer_name.split(" ")[0]
    reason_desc = custom_reason.strip() if reason_key == "custom" and custom_reason else REASON_CONTEXT.get(reason_key, "a general check-in")
    turn_count = sum(1 for t in history if t.get("role") == "user")

    gen = generate or _default_generate()
    if gen is not None:
        convo = "\n".join(f"{t.get('role', '?')}: {t.get('text', '')}" for t in history[-10:])
        prompt = (
            "You are REX, an AI voice agent mid-call with a customer on behalf of a Paytm merchant "
            f"called {merchant!r}, speaking Hinglish.\n"
            f"Customer: {customer_name!r}. Reason for the call: {reason_desc}.\n"
            f"Call so far:\n{convo}\n"
            f"Customer just said: {message!r}\n\n"
            "Respond with ONLY JSON of this exact shape:\n"
            '{"reply_text": "<REX\'s next spoken line, Hinglish, at most 2 short sentences>", '
            '"call_ended": <true if the conversation has reached a natural close — the customer said '
            "bye/thanks/confirmed something and REX just said a closing line — otherwise false>}\n"
            "Stay on topic, be warm and brief, and move the conversation toward a resolution (a promise "
            "to pay, a retry, confirmation, or a polite goodbye) rather than looping."
        )
        try:
            raw = gen(prompt)
            data = json.loads(raw)
            if isinstance(data, dict) and "reply_text" in data:
                data.setdefault("call_ended", False)
                return data  # type: ignore[return-value]
        except Exception as exc:  # pragma: no cover
            logger.warning("Call turn generation failed (%s); using fallback.", exc)

    return _fallback_turn(message, first, turn_count, locale)


_GOODBYE_WORDS = ("bye", "thik", "theek", "dhanyavad", "dhanyawad", "thanks", "rakhta hoon", "alvida", "ok done", "done hai")


def _fallback_turn(message: str, first_name: str, turn_count: int, locale: str) -> CallTurnResult:
    lower = message.lower()
    if turn_count >= 2 or any(w in lower for w in _GOODBYE_WORDS):
        return {
            "reply_text": f"Theek hai {first_name} ji, samajh gaya. Aapka time dene ke liye dhanyawad, alvida!",
            "call_ended": True,
        }
    if turn_count == 0:
        return {
            "reply_text": "Ji bilkul samajhta hoon. Kya aap is hafte ke andar ise clear kar payenge, ya koi aur tareeka dekhein?",
            "call_ended": False,
        }
    return {
        "reply_text": "Theek hai, noted kar liya maine. Kuch aur poochna hai aapko is baare mein?",
        "call_ended": False,
    }


def _default_generate() -> GenerateFn | None:
    """JSON-forcing generator — for continue_call's {reply_text, call_ended} turns."""
    try:
        from app.services.gemini_client import build_generate

        return build_generate()
    except Exception:  # pragma: no cover
        return None


def _default_text_generate() -> GenerateFn | None:
    """Plain-text generator — for start_call's single spoken line (no JSON wrapper)."""
    try:
        from app.services.gemini_client import build_text_generate

        return build_text_generate()
    except Exception:  # pragma: no cover
        return None
