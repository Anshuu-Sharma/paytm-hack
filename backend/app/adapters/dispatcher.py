"""Channel dispatcher.

The orchestrator's ``execute`` node hands an already-approved ``ProposedAction``
here; the dispatcher maps it to the right adapter, filling in the customer
contact and amount from the transaction record. Live vs simulated is decided once
(``live_mode``) and applied uniformly across channels.
"""

from typing import Callable

from sqlalchemy.orm import Session

from app.adapters.base import DispatchResult
from app.adapters.paytm_actions import PaytmActionsAdapter
from app.adapters.voice import VoiceAdapter
from app.adapters.whatsapp import WhatsAppAdapter
from app.config import settings
from app.enums import InterventionAction
from app.models import TransactionState
from app.services.policy_sandbox import ProposedAction

# Terse, transparent copy - the PRD stresses explaining the technical glitch
# honestly rather than hiding it.
_WHATSAPP_BODY = "We hit a temporary payment glitch on our side. Here's a secure 1-tap link to complete it - no OTP needed."
_VOICE_SCRIPT = "Namaste, aapke recent payment mein ek technical dikkat aayi thi. Hum aapko ek chhota seset link bhej rahe hain."


def build_dispatcher(db: Session, live_mode: bool | None = None) -> Callable[[ProposedAction, dict], DispatchResult]:
    live = settings.live_mode if live_mode is None else live_mode
    whatsapp = WhatsAppAdapter(live_mode=live)
    voice = VoiceAdapter(live_mode=live)
    paytm = PaytmActionsAdapter(live_mode=live)

    def dispatch(action: ProposedAction, state: dict) -> DispatchResult:
        txn = (
            db.query(TransactionState)
            .filter_by(transaction_id=state["transaction_id"])
            .one()
        )
        to = txn.customer_contact
        amount = action.amount_minor or txn.amount_minor

        match action.action_value:
            case InterventionAction.SEND_WHATSAPP.value | InterventionAction.OFFER_FEE_WAIVER.value:
                return whatsapp.send(to=to, body=_WHATSAPP_BODY)
            case InterventionAction.VOICE_CALL.value:
                return voice.call(to=to, script=_VOICE_SCRIPT)
            case InterventionAction.GENERATE_PAYMENT_LINK.value:
                return paytm.create_payment_link(amount_minor=amount, contact=to)
            case InterventionAction.RETRY_CHARGE.value:
                return paytm.retry_charge(transaction_id=txn.transaction_id)
            case InterventionAction.CANCEL_SUBSCRIPTION.value:
                return paytm.cancel_subscription(transaction_id=txn.transaction_id)
            case other:  # pragma: no cover - guarded by the sandbox's allowed_actions
                raise ValueError(f"No dispatcher route for action {other!r}")

    return dispatch
