"""WhatsApp channel via Twilio.

In simulation mode the send is recorded and returned without touching the
network. In live mode it uses the Twilio REST client (sandbox or business
number). The client is built lazily so importing this module - and running the
whole test suite in sim mode - needs no Twilio credentials.
"""

import logging
import uuid

from app.adapters.base import DispatchResult
from app.config import settings

logger = logging.getLogger(__name__)

_CHANNEL = "WHATSAPP"


class WhatsAppAdapter:
    def __init__(self, live_mode: bool, client=None, from_: str | None = None):
        self._live = live_mode
        self._client = client
        self._from = from_ or settings.twilio_whatsapp_from

    def _twilio(self):
        if self._client is None:
            from twilio.rest import Client

            if settings.twilio_api_key_sid:
                # API Key auth: (key_sid, key_secret, account_sid).
                self._client = Client(
                    settings.twilio_api_key_sid,
                    settings.twilio_api_key_secret,
                    settings.twilio_account_sid,
                )
            else:
                self._client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        return self._client

    def send(self, to: str, body: str) -> DispatchResult:
        if not self._live:
            return DispatchResult(_CHANNEL, delivered=True, simulated=True, reference=f"sim_{uuid.uuid4().hex[:12]}")

        try:
            message = self._twilio().messages.create(
                from_=self._from,
                to=f"whatsapp:{to}",
                body=body,
            )
        except Exception as exc:  # Twilio/network errors must not crash the graph
            logger.warning("Live WhatsApp send failed: %s", exc)
            return DispatchResult(_CHANNEL, delivered=False, simulated=False, detail=str(exc))
        return DispatchResult(_CHANNEL, delivered=True, simulated=False, reference=message.sid)
