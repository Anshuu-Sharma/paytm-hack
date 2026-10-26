"""Human-escalation helper.

A single place to route a transaction off the automated path and onto a human's
desk. Kept deliberately narrow (persist the ticket, return it) so the caller -
the orchestrator - stays in control of the accompanying state transition and
audit entry.
"""

from sqlalchemy.orm import Session

from app.enums import StoppingRule
from app.models import EscalationQueue


def enqueue_escalation(
    db: Session,
    *,
    transaction_id: str,
    reason: str,
    rule: StoppingRule | None = None,
) -> EscalationQueue:
    ticket = EscalationQueue(
        transaction_id=transaction_id,
        reason=reason,
        rule=rule,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket
