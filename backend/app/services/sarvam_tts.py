"""Text-to-speech for REX's spoken replies, via Sarvam AI (Bulbul).

Kept intentionally small and side-effect-free: given text, return MP3 bytes — or
None when no key is configured or the call fails, which is the signal for the
frontend to fall back to the browser's own voice. Using Sarvam's Bulbul v4-flash
model for human, low-latency Indian language / Hinglish prosody.
"""

from __future__ import annotations

import base64
import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_ENDPOINT = "https://api.sarvam.ai/text-to-speech"
_PRIMARY_SPEAKER = "amit_hi_conversational"
_FALLBACK_SPEAKER = "aayan_hi_conversational"


def _request_tts(
    text: str,
    *,
    key: str,
    speaker: str | None,
    model: str,
    language_code: str,
    pace: float = 1.0,
) -> tuple[int, Any]:
    payload: dict[str, Any] = {
        "inputs": [text[:2500]],
        "target_language_code": language_code,
        "model": model,
        "pace": pace,
        "speech_sample_rate": 24000,
        "audio_codec": "mp3",
        "enable_preprocessing": True,
    }
    if speaker:
        payload["speaker"] = speaker

    headers = {
        "api-subscription-key": key,
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=30.0) as client:
        resp = client.post(_ENDPOINT, headers=headers, json=payload)
    if resp.status_code == 200:
        data = resp.json()
        audios = data.get("audios") or []
        if audios and isinstance(audios[0], str):
            return 200, base64.b64decode(audios[0])
        return 500, b""
    return resp.status_code, resp.text.encode()[:200]


def synthesize(
    text: str,
    *,
    api_key: str | None = None,
    speaker: str | None = None,
    model: str | None = None,
    language_code: str | None = None,
    pace: float = 1.0,
) -> bytes | None:
    key = api_key if api_key is not None else settings.sarvam_api_key
    if not key or not text.strip():
        return None

    spk = speaker or settings.sarvam_tts_speaker or _PRIMARY_SPEAKER
    mdl = model or settings.sarvam_tts_model or "bulbul:v4-flash"
    lang = language_code or settings.sarvam_tts_language or "hi-IN"

    try:
        status, body = _request_tts(
            text, key=key, speaker=spk, model=mdl, language_code=lang, pace=pace
        )
        if status == 200 and isinstance(body, bytes) and len(body) > 0:
            return body

        logger.warning("Sarvam TTS failed for speaker %s (%s): %s", spk, status, body[:180])

        # Attempt fallback speaker 1
        if spk != _PRIMARY_SPEAKER:
            status, body = _request_tts(
                text, key=key, speaker=_PRIMARY_SPEAKER, model=mdl, language_code=lang, pace=pace
            )
            if status == 200 and isinstance(body, bytes) and len(body) > 0:
                return body

        # Attempt fallback speaker 2
        if spk != _FALLBACK_SPEAKER:
            status, body = _request_tts(
                text, key=key, speaker=_FALLBACK_SPEAKER, model=mdl, language_code=lang, pace=pace
            )
            if status == 200 and isinstance(body, bytes) and len(body) > 0:
                return body

        # Final attempt: omit speaker to let Sarvam use model default
        status, body = _request_tts(
            text, key=key, speaker=None, model=mdl, language_code=lang, pace=pace
        )
        if status == 200 and isinstance(body, bytes) and len(body) > 0:
            return body

    except Exception as exc:
        logger.warning("Sarvam TTS error (%s); frontend will use browser voice.", exc)

    return None
