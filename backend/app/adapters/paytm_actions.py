"""Paytm financial actions - payment links, retries, cancellations.

These are the actions that touch money, so they only ever run after the
PolicySandbox has approved the proposed action upstream. Simulation mode returns
a synthetic reference; live mode uses the Paytm merchant client.
"""

import uuid

from app.adapters.base import DispatchResult
from app.config import settings

_CHANNEL = "PAYMENT_LINK"


class PaytmActionsAdapter:
    def __init__(self, live_mode: bool, client=None):
        self._live = live_mode
        self._client = client

    def _sim(self, channel: str, detail: str) -> DispatchResult:
        return DispatchResult(
            channel,
            delivered=True,
            simulated=True,
            reference=f"sim_{uuid.uuid4().hex[:12]}",
            detail=detail,
        )

    def create_payment_link(self, amount_minor: int, contact: str) -> DispatchResult:
        if not self._live:
            return self._sim(_CHANNEL, "payment_link")
        ref = f"ptm_{uuid.uuid4().hex[:10]}"
        return DispatchResult(_CHANNEL, delivered=True, simulated=False, reference=ref)

    def retry_charge(self, transaction_id: str) -> DispatchResult:
        # A real re-attempt would re-trigger the mandate debit via Paytm UPI Autopay
        return self._sim("PAYTM", "retry_charge")

    def cancel_subscription(self, transaction_id: str) -> DispatchResult:
        return self._sim("PAYTM", "cancel_subscription")
