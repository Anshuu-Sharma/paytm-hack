"""Model registry.

Importing every model here guarantees they are all attached to ``Base``'s
metadata as soon as the package is imported, so table creation no longer
depends on the order models happen to be imported elsewhere.
"""

from app.models.audit_trail import AuditTrail
from app.models.call import CallSession, CallTurn
from app.models.escalation import EscalationQueue
from app.models.merchant_policy import MerchantPolicy
from app.models.message import Message
from app.models.processed_event import ProcessedEvent
from app.models.transaction_state import TransactionState

__all__ = [
    "AuditTrail",
    "CallSession",
    "CallTurn",
    "EscalationQueue",
    "MerchantPolicy",
    "Message",
    "ProcessedEvent",
    "TransactionState",
]
