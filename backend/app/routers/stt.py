"""Speech-to-text endpoint powered by Sarvam AI (Saaras).

Accepts an audio recording from the browser's MediaRecorder and forwards it to
Sarvam's synchronous STT REST API (saaras:v4) with codemix (Hinglish) support.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
import httpx

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["speech"])

_ENDPOINT = "https://api.sarvam.ai/speech-to-text"


@router.post("/assistant/stt")
async def transcribe(
    file: Annotated[UploadFile, File(description="Audio file to transcribe (WebM, WAV, MP3)")],
    language_code: Annotated[str, Form()] = "hi-IN",
    mode: Annotated[str, Form()] = "codemix",
) -> dict:
    key = settings.sarvam_api_key
    if not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sarvam AI API key is not configured.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty audio payload received.",
        )

    # Normalize language code for Sarvam
    lang = "hi-IN" if language_code.startswith("hi") else "en-IN"

    files = {
        "file": (
            file.filename or "recording.webm",
            content,
            file.content_type or "audio/webm",
        )
    }
    data = {
        "model": settings.sarvam_stt_model or "saaras:v4",
        "mode": mode,
        "language_code": lang,
    }
    headers = {
        "api-subscription-key": key,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(_ENDPOINT, headers=headers, files=files, data=data)
        if resp.status_code == 200:
            result = resp.json()
            return {
                "transcript": result.get("transcript", "").strip(),
                "language_code": result.get("language_code", lang),
            }
        logger.warning("Sarvam STT failed (%s): %s", resp.status_code, resp.text[:200])
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Sarvam STT transcription failed with status {resp.status_code}",
        )
    except httpx.RequestError as exc:
        logger.error("Network error calling Sarvam STT: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not reach Sarvam STT service.",
        ) from exc

