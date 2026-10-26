"""Recovery metrics and the escalation queue - the judge-facing surface.

``/metrics`` is the headline: measured money recovered across the batch (GRRR),
broken down by failure class, with intervention/escalation/stopping-rule counts.
``/escalations`` exposes the human-handoff queue that proves compliant escalation.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.enums import EscalationStatus
from app.models import EscalationQueue
from app.services.reconciliation import compute_metrics

router = APIRouter(tags=["metrics"])


@router.get("/metrics")
def get_metrics(db: Session = Depends(get_db)) -> dict:
    return compute_metrics(db)


@router.post("/escalations/{ticket_id}/resolve")
def resolve_escalation(ticket_id: int, db: Session = Depends(get_db)) -> dict:
    """Operator closes a human-handoff ticket."""
    ticket = db.query(EscalationQueue).filter_by(id=ticket_id).one_or_none()
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Escalation not found")
    ticket.status = EscalationStatus.RESOLVED
    db.commit()
    return {
        "id": ticket.id,
        "transaction_id": ticket.transaction_id,
        "status": ticket.status.value,
    }


@router.get("/escalations")
def get_escalations(db: Session = Depends(get_db)) -> list[dict]:
    tickets = db.query(EscalationQueue).order_by(EscalationQueue.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "transaction_id": t.transaction_id,
            "reason": t.reason,
            "rule": t.rule.value if t.rule else None,
            "status": t.status.value,
            "created_at": t.created_at.isoformat(),
        }
        for t in tickets
    ]
