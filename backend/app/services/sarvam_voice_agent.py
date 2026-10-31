"""Sarvam AI + Gemini Voice Agent pipeline for interactive recovery calls.

Orchestrates full-duplex live voice recovery calls:
  Browser Mic (WebM/WAV) -> Sarvam Saaras v4 STT -> transcript
  -> Gemini (Hinglish Recovery Agent) -> reply text
  -> Sarvam Bulbul v4-flash TTS -> audio chunks -> Browser Speaker
"""

from __future__ import annotations

import base64
import logging
import time
from typing import Any

from fastapi import WebSocket
import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.enums import CallSpeaker, CallStatus
from app.models.call import CallSession, CallTurn
from app.models.transaction_state import TransactionState
from app.services.gemini_client import build_text_generate
from app.services.payment_links import create_payment_link
from app.services.sarvam_tts import synthesize

logger = logging.getLogger(__name__)

_STT_ENDPOINT = "https://api.sarvam.ai/speech-to-text"


def transcribe_audio_chunk(audio_bytes: bytes, mime_type: str = "audio/wav") -> str:
    """Transcribes an audio chunk using Sarvam's Saaras v4 STT."""
    key = settings.sarvam_api_key
    if not key or not audio_bytes or len(audio_bytes) < 800:
        return ""

    # Auto-detect audio container
    if audio_bytes.startswith(b"RIFF"):
        filename = "voice_input.wav"
        content_type = "audio/wav"
    elif audio_bytes.startswith(b"\x1aE\xdf\xa3"):
        filename = "voice_input.webm"
        content_type = "audio/webm"
    elif audio_bytes.startswith(b"ID3") or audio_bytes.startswith(b"\xff\xfb") or audio_bytes.startswith(b"\xff\xf3"):
        filename = "voice_input.mp3"
        content_type = "audio/mpeg"
    else:
        filename = "voice_input.wav"
        content_type = mime_type or "audio/wav"

    files = {
        "file": (filename, audio_bytes, content_type),
    }
    data = {
        "model": settings.sarvam_stt_model or "saaras:v4",
        "mode": "codemix",
        "language_code": "hi-IN",
    }
    headers = {"api-subscription-key": key}

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(_STT_ENDPOINT, headers=headers, files=files, data=data)
        if resp.status_code == 200:
            result = resp.json()
            return result.get("transcript", "").strip()
        logger.warning("Sarvam STT returned status %s: %s", resp.status_code, resp.text[:150])
    except Exception as exc:
        logger.warning("Sarvam STT error: %s", exc)

    return ""


def generate_agent_reply(
    customer_name: str,
    amount_inr: float,
    failure_reason: str,
    turns: list[dict[str, str]],
) -> tuple[str, bool]:
    """Generates REX recovery agent reply using Gemini or fallback.

    Returns:
        tuple[str, bool]: (reply_text, should_send_payment_link)
    """
    first_name = (customer_name or "there").split()[0]
    rupees = f"₹{int(amount_inr):,}"

    prompt = f"""You are REX, an empathetic AI recovery agent calling a customer regarding their failed Paytm payment.
Customer Name: {first_name}
Amount: {rupees}
Failure Reason: {failure_reason or 'Bank server timeout'}

Conversation turns so far:
"""
    for t in turns[-6:]:
        prompt += f"{t['speaker']}: {t['text']}\n"

    prompt += f"""
Instructions:
- Write REX's next spoken line to {first_name}.
- Use natural, polite, comforting Hinglish (Hindi + English).
- Keep it very brief: 1 to 2 sentences max (spoken over the phone).
- If the customer agrees or says 'haan', 'theek hai', 'bhej do', 'yes', or asks for the link, confirm that you sent a 1-tap Paytm link to their WhatsApp, and add [SEND_LINK] at the very end.
- Output ONLY the spoken words (and [SEND_LINK] if applicable), nothing else.
"""

    should_send_link = False
    try:
        generate = build_text_generate()
        reply = generate(prompt).strip()
        if "[SEND_LINK]" in reply:
            should_send_link = True
            reply = reply.replace("[SEND_LINK]", "").strip()
        if reply:
            return reply, should_send_link
    except Exception as exc:
        logger.warning("Gemini voice response generation failed (%s), using fallback", exc)

    # Fallback heuristic if LLM generation is unavailable
    last_user_text = turns[-1]["text"].lower() if turns else ""
    if any(w in last_user_text for w in ("haan", "ha", "yes", "theek", "bhej", "send", "ok", "sure", "kar do")):
        return f"Maine aapke WhatsApp par secure 1-tap Paytm link bhej diya hai. Ek tap mein payment ho jayegi.", True
    elif any(w in last_user_text for w in ("nahi", "no", "bad mein", "later", "cancel")):
        return "Koi baat nahi ji. Agar aapko baad mein zaroorat ho toh WhatsApp par link uplabdh rahega. Dhanyawad!", False
    else:
        return f"Aap chinta mat kijiye. Main WhatsApp par 1-tap Paytm link bhej deta hoon, OTP ki zaroorat nahi padegi.", True


async def handle_voice_call_session(
    websocket: WebSocket,
    transaction_id: str,
    db: Session,
) -> None:
    """Manages the full lifecycle of a Sarvam voice call over WebSocket."""
    await websocket.accept()

    txn = db.query(TransactionState).filter_by(transaction_id=transaction_id).first()
    if not txn:
        await websocket.send_json({"type": "error", "message": "Transaction not found"})
        await websocket.close()
        return

    meta = txn.metadata_json or {}
    customer_name = meta.get("customer_name") or "customer"
    first_name = customer_name.split()[0]
    amount_inr = (txn.amount_minor or 0) / 100
    rupees = f"₹{int(amount_inr):,}"
    failure_reason = meta.get("error_description") or "bank switch failure"

    # Create CallSession in database
    session = CallSession(
        transaction_id=transaction_id,
        status=CallStatus.IN_PROGRESS,
        duration_sec=0,
        provider="sarvam",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    start_time = time.time()
    turns_history: list[dict[str, str]] = []

    # Send initial greeting
    greeting_text = (
        f"Namaste {first_name} ji, main REX bol raha hoon Paytm Support se. "
        f"Aapke {rupees} ke payment mein ek chhota glitch aa gaya tha. "
        f"Kya main WhatsApp par 1-tap payment link bhej doon?"
    )

    turn_db = CallTurn(
        call_session_id=session.id,
        speaker=CallSpeaker.AGENT,
        text=greeting_text,
        seq=0,
        at_offset_sec=0,
    )
    db.add(turn_db)
    db.commit()
    turns_history.append({"speaker": "REX", "text": greeting_text})

    # Notify frontend of connected state + greeting turn
    await websocket.send_json({
        "type": "turn",
        "speaker": "AGENT",
        "text": greeting_text,
    })

    # Synthesize greeting via Sarvam TTS
    greeting_audio = synthesize(
        greeting_text,
        speaker=settings.sarvam_tts_speaker or "amit_hi_conversational",
        language_code="hi-IN",
    )
    if greeting_audio:
        await websocket.send_json({
            "type": "audio_chunk",
            "data": base64.b64encode(greeting_audio).decode("utf-8"),
        })

    turn_seq = 1

    try:
        while True:
            msg = await websocket.receive_json()
            msg_type = msg.get("type")

            if msg_type == "hangup":
                break

            elif msg_type == "audio":
                # Audio payload from browser mic
                b64_audio = msg.get("data", "")
                if not b64_audio:
                    continue

                audio_bytes = base64.b64decode(b64_audio)
                transcript = transcribe_audio_chunk(audio_bytes)

                if not transcript:
                    continue

                # Record user turn
                offset = int(time.time() - start_time)
                user_turn = CallTurn(
                    call_session_id=session.id,
                    speaker=CallSpeaker.CUSTOMER,
                    text=transcript,
                    seq=turn_seq,
                    at_offset_sec=offset,
                )
                db.add(user_turn)
                db.commit()
                turns_history.append({"speaker": "Customer", "text": transcript})
                turn_seq += 1

                # Send user turn to frontend
                await websocket.send_json({
                    "type": "turn",
                    "speaker": "USER",
                    "text": transcript,
                })

                # Generate REX reply
                reply_text, send_link = generate_agent_reply(
                    customer_name=customer_name,
                    amount_inr=amount_inr,
                    failure_reason=failure_reason,
                    turns=turns_history,
                )

                # If link needs to be sent, mint it now
                if send_link:
                    try:
                        create_payment_link(db, transaction_id)
                        await websocket.send_json({"type": "link_sent"})
                    except Exception as exc:
                        logger.warning("Could not auto-create payment link in call: %s", exc)

                # Record agent turn
                offset = int(time.time() - start_time)
                agent_turn = CallTurn(
                    call_session_id=session.id,
                    speaker=CallSpeaker.AGENT,
                    text=reply_text,
                    seq=turn_seq,
                    at_offset_sec=offset,
                )
                db.add(agent_turn)
                db.commit()
                turns_history.append({"speaker": "REX", "text": reply_text})
                turn_seq += 1

                # Send agent turn to frontend
                await websocket.send_json({
                    "type": "turn",
                    "speaker": "AGENT",
                    "text": reply_text,
                })

                # Synthesize agent reply via Sarvam Bulbul TTS
                reply_audio = synthesize(
                    reply_text,
                    speaker=settings.sarvam_tts_speaker or "amit_hi_conversational",
                    language_code="hi-IN",
                )
                if reply_audio:
                    await websocket.send_json({
                        "type": "audio_chunk",
                        "data": base64.b64encode(reply_audio).decode("utf-8"),
                    })

            elif msg_type == "send_payment_link":
                try:
                    create_payment_link(db, transaction_id)
                    await websocket.send_json({"type": "link_sent"})
                    notice = "Maine aapke WhatsApp par payment link bhej diya hai."
                    await websocket.send_json({
                        "type": "turn",
                        "speaker": "AGENT",
                        "text": notice,
                    })
                    audio = synthesize(notice, speaker=settings.sarvam_tts_speaker or "amit_hi_conversational")
                    if audio:
                        await websocket.send_json({
                            "type": "audio_chunk",
                            "data": base64.b64encode(audio).decode("utf-8"),
                        })
                except Exception as exc:
                    logger.warning("Payment link dispatch error: %s", exc)

    except Exception as exc:
        logger.info("Voice call session ended (%s)", exc)
    finally:
        total_duration = max(1, int(time.time() - start_time))
        session.duration_sec = total_duration
        session.status = CallStatus.COMPLETED
        session.outcome = "PAYMENT_LINK_SENT" if any(t.get("speaker") == "REX" and "link" in t.get("text", "").lower() for t in turns_history) else "RESOLVED"
        db.commit()

        try:
            await websocket.send_json({"type": "ended", "duration_sec": total_duration})
            await websocket.close()
        except Exception:
            pass

