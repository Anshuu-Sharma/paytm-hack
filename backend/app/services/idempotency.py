"""Webhook idempotency.

DB-backed by default: a unique ``event_id`` row is the lock. This keeps the
hackathon build zero-config (no external cache to stand up), while leaving room
to swap in Upstash Redis later behind the same ``claim_event`` interface for a
distributed deployment.
"""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.processed_event import ProcessedEvent


def claim_event(db: Session, event_id: str) -> bool:
    """Atomically claim an ``event_id``.

    Returns ``True`` if this call is the first to claim the id (caller should
    process the event), ``False`` if it was already claimed (a duplicate/retry
    that must be ignored). The unique constraint does the arbitration, so the
    check-and-set is race-free rather than a read-then-write.
    """
    db.add(ProcessedEvent(event_id=event_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return False
    return True
