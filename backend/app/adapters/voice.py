"""Hinglish voice channel (Vapi).

We do not yet hold Vapi credentials, so the live path is a guarded stub: without
an API key the adapter stays simulated even when live mode is on, and never
pretends a call was placed. When a key is provided the live branch is where the
Vapi call would be initiated.
"""

import uuid

from app.adapters.base import DispatchResult
from app.config import settings

_CHANNEL = "VOICE"


class VoiceAdapter:
    def __init__(self, live_mode: bool, api_key: str | None = None):
        self._live = live_mode
        self._api_key = settings.vapi_api_key if api_key is None else api_key

    def call(self, to: str, script: str) -> DispatchResult:
        if not self._live or not self._api_key:
            detail = None if self._api_key else "vapi_not_configured"
            return DispatchResult(
                _CHANNEL, delivered=True, simulated=True,
                reference=f"sim_{uuid.uuid4().hex[:12]}", detail=detail,
            )

        # Live Vapi call would be initiated here once credentials are available.
        raise NotImplementedError("Live Vapi voice calls are not wired yet.")
