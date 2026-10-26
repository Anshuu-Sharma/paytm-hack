from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    JSON,
    String,
    event,
)
from sqlalchemy.exc import InvalidRequestError

from app.database import Base
from app.enums import ActionType, NodeName, Outcome
from app.utils import utcnow


class AuditTrail(Base):
    """Append-only ledger of every action the orchestrator takes.

    Immutability is enforced below via ORM events: once written, an audit row
    cannot be updated or deleted, so the trail stays tamper-evident.
    """

    __tablename__ = "audit_trails"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(64), unique=True, index=True, nullable=False)
    transaction_id = Column(
        String(64),
        ForeignKey("transaction_states.transaction_id"),
        index=True,
        nullable=False,
    )
    timestamp = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    node_name = Column(Enum(NodeName, validate_strings=True), nullable=False)
    action_type = Column(Enum(ActionType, validate_strings=True), nullable=False)
    payload = Column(JSON, nullable=False)
    outcome = Column(Enum(Outcome, validate_strings=True), nullable=False)


@event.listens_for(AuditTrail, "before_update", propagate=True)
def _block_audit_update(mapper, connection, target):
    raise InvalidRequestError("AuditTrail rows are append-only and cannot be modified.")


@event.listens_for(AuditTrail, "before_delete", propagate=True)
def _block_audit_delete(mapper, connection, target):
    raise InvalidRequestError("AuditTrail rows are append-only and cannot be deleted.")
