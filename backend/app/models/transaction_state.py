from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    Integer,
    JSON,
    String,
)
from sqlalchemy.orm import relationship

from app.database import Base
from app.enums import TransactionLifecycleState
from app.security import EncryptedString
from app.utils import utcnow


class TransactionState(Base):
    __tablename__ = "transaction_states"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String(64), unique=True, index=True, nullable=False)
    # Indexed because interventions are frequently reconciled back to the
    # originating Paytm payment.
    paytm_payment_id = Column(String(64), index=True, nullable=False)
    # Constrained to the four PRD failure classes at the DB level.
    failure_class = Column(Integer, nullable=False)
    current_state = Column(
        Enum(TransactionLifecycleState, validate_strings=True),
        default=TransactionLifecycleState.PENDING,
        nullable=False,
    )
    retry_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)
    merchant_id = Column(String(64), nullable=False)
    # PII: encrypted at rest via Fernet (see app/security.py).
    customer_contact = Column(EncryptedString(256), nullable=False)
    # Amount is stored in the currency's minor unit (paise for INR), matching
    # standard payment gateway convention. Named accordingly to avoid the "cents" ambiguity.
    amount_minor = Column(Integer, nullable=False)
    currency = Column(String(3), default="INR", nullable=False)
    metadata_json = Column(JSON, nullable=True)  # 'metadata' is reserved on SQLAlchemy's Base
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    audit_trails = relationship("AuditTrail", backref="transaction_state")

    __table_args__ = (
        CheckConstraint(
            "failure_class BETWEEN 1 AND 4", name="ck_failure_class_range"
        ),
        CheckConstraint("retry_count >= 0", name="ck_retry_count_non_negative"),
        CheckConstraint("amount_minor >= 0", name="ck_amount_non_negative"),
    )
