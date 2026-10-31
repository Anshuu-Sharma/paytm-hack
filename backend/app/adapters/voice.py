"""Hinglish voice channel (Sarvam AI).

Synthesizes outbound voice call audio via Sarvam AI's Bulbul model. Without an
API key or in test mode the adapter stays simulated and never pretends a live call
was placed. When a key is provided and live mode is on, the call script is
synthesized with Sarvam AI's Indian-language voice model for outbound dispatch.
"""

import uuid

from app.adapters.base import DispatchResult
from app.config import settings
from app.services.sarvam_tts import synthesize

_CHANNEL = "VOICE"


class VoiceAdapter:
    def __init__(self, live_mode: bool, api_key: str | None = None):
        self._live = live_mode
        self._api_key = settings.sarvam_api_key if api_key is None else api_key

    def call(self, to: str, script: str) -> DispatchResult:
        if not self._live or not self._api_key:
            detail = None if self._api_key else "sarvam_not_configured"
            return DispatchResult(
                _CHANNEL,
                delivered=True,
                simulated=True,
                reference=f"sim_{uuid.uuid4().hex[:12]}",
                detail=detail,
            )

        # In live mode with credentials, synthesize call audio via Sarvam Bulbul TTS
        audio = synthesize(
            script,
            api_key=self._api_key,
            speaker=settings.sarvam_tts_speaker or "priya_hi_customer",
            language_code="hi-IN",
        )
        delivered = audio is not None and len(audio) > 0
        return DispatchResult(
            _CHANNEL,
            delivered=delivered,
            simulated=False,
            reference=f"srv_{uuid.uuid4().hex[:12]}",
            detail="sarvam_voice_dispatched" if delivered else "sarvam_tts_failed",
        )
