"""Text-to-speech for REX's spoken replies, via ElevenLabs.

Kept intentionally small and side-effect-free: given text, return MP3 bytes — or
None when no key is configured or the call fails, which is the signal for the
frontend to fall back to the browser's own voice. Using ElevenLabs' multilingual
model so Hindi / Hinglish replies sound human.
"""

from __future__ import annotations

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
# A "premade" voice every account (including the free tier) can use via the API.
# Library voices require a paid plan, so if the configured voice is blocked we
# retry with this one rather than falling all the way back to the browser voice.
_FALLBACK_VOICE = "EXAVITQu4vr4xnSDxMaL"  # Sarah — mature, reassuring, confident


def _speak(voice: str, text: str, key: str, model: str) -> tuple[int, bytes]:
    resp = httpx.post(
        _ENDPOINT.format(voice_id=voice),
        headers={"xi-api-key": key, "content-type": "application/json"},
        json={
            "text": text,
            "model_id": model,
            "voice_settings": {"stability": 0.4, "similarity_boost": 0.85},
        },
        timeout=30.0,
    )
    return resp.status_code, resp.content if resp.status_code == 200 else resp.text.encode()[:200]


def synthesize(
    text: str,
    *,
    api_key: str | None = None,
    voice_id: str | None = None,
    model: str | None = None,
) -> bytes | None:
    key = api_key if api_key is not None else settings.elevenlabs_api_key
    if not key or not text.strip():
        return None
    voice = voice_id or settings.elevenlabs_voice_id
    mdl = model or settings.elevenlabs_model
    try:
        status, body = _speak(voice, text, key, mdl)
        if status == 200:
            return body
        logger.warning("ElevenLabs TTS failed for voice %s (%s): %s", voice, status, body[:180])
        # Voice-level block (paid-only library voice) → retry a free premade voice.
        if status in (401, 402, 403, 404) and voice != _FALLBACK_VOICE:
            status, body = _speak(_FALLBACK_VOICE, text, key, mdl)
            if status == 200:
                return body
            logger.warning("ElevenLabs fallback voice also failed (%s): %s", status, body[:180])
    except Exception as exc:  # network/SDK error → browser fallback
        logger.warning("ElevenLabs TTS error (%s); frontend will use browser voice.", exc)
    return None
