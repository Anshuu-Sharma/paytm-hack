from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String

from app.database import Base
from app.enums import EscalationStatus, StoppingRule
from app.utils import utcnow


class EscalationQueue(Base):
    """Human-handoff ledger.

    When a workflow must leave the automated path - a dispute, an unrecognised
    signal, or a policy block that needs judgement - a ticket lands here with the
    reason and (when applicable) the stopping rule that triggered it. This is the
    concrete "compliant escalation" artifact the recovery bar asks for.
    """

    __tablename__ = "escalation_queue"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(
        String(64),
        ForeignKey("transaction_states.transaction_id"),
        index=True,
        nullable=False,
    )
    reason = Column(String(512), nullable=False)
    # Nullable: policy blocks / unknown signals escalate without a named rule.
    rule = Column(Enum(StoppingRule, validate_strings=True), nullable=True)
    status = Column(
        Enum(EscalationStatus, validate_strings=True),
        default=EscalationStatus.OPEN,
        nullable=False,
    )
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
