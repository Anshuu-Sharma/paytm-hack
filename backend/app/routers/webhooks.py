"""Paytm webhook ingestion.

This is the single entry point where at-risk revenue enters the engine. Order of
operations is deliberate and security-first:

1. Verify the HMAC signature over the *raw* body — reject spoofed callers before
   any parsing or DB work.
2. Claim the delivery ``event_id`` for idempotency — gateways retry, and we must
   never run a recovery workflow twice for the same event.
3. Classify deterministically and persist the ``TransactionState``.
4. Append an immutable ``WEBHOOK_INGESTED`` audit entry.

Orchestration (LangGraph) is kicked off from here: diagnose -> gate -> intervene.
"""

import hashlib
import hmac
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.enums import (
    ActionType,
    NodeName,
    Outcome,
    TransactionLifecycleState,
)
from app.models import TransactionState
from app.orchestrator.factory import get_orchestrator_deps
from app.orchestrator.graph import OrchestratorDeps, build_recovery_graph
from app.services.audit import record_audit
from app.services.classifier import UnclassifiableSignal, classify
from app.services.idempotency import claim_event

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _signature_is_valid(raw_body: bytes, signature: str | None) -> bool:
    """Constant-time verification of Paytm HMAC-SHA256 body signature."""
    secret = settings.paytm_webhook_secret
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def _extract_entity(body: dict[str, Any]) -> dict[str, Any]:
    """Pull the domain entity out of payload nesting."""
    payload = body.get("payload") or {}
    for wrapper in payload.values():
        if isinstance(wrapper, dict) and "entity" in wrapper:
            return wrapper["entity"] or {}
    if "entity" in body and isinstance(body["entity"], dict):
        return body["entity"]
    return body.get("data") or {}


@router.post("/paytm")
@router.post("/gateway")
async def ingest_paytm_event(
    request: Request,
    db: Session = Depends(get_db),
    deps: OrchestratorDeps = Depends(get_orchestrator_deps),
    x_paytm_signature: str | None = Header(default=None),
    x_paytm_event_id: str | None = Header(default=None),
    x_signature: str | None = Header(default=None),
    x_event_id: str | None = Header(default=None),
):
    raw_body = await request.body()
    signature = x_paytm_signature or x_signature

    if not _signature_is_valid(raw_body, signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature.",
        )

    body = await request.json()
    event_type = body.get("event", "")
    event_id = x_paytm_event_id or x_event_id or body.get("id")
    if not event_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing webhook event id.",
        )

    if not claim_event(db, event_id):
        # A retry of an already-processed delivery: acknowledge without redoing
        # any recovery work.
        return {"status": "duplicate", "event_id": event_id}

    entity = _extract_entity(body)
    notes = entity.get("notes") or {}
    error_code = entity.get("error_code")

    try:
        failure_class = classify(event_type=event_type, error_code=error_code)
    except UnclassifiableSignal as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    entity_id = entity.get("id", "")
    transaction_id = notes.get("transaction_id") or entity_id
    customer_contact = entity.get("contact") or notes.get("contact") or ""
    merchant_id = notes.get("merchant_id") or "unknown"

    # Get-or-create: a later event for the same transaction updates its routing
    # rather than colliding on the unique ``transaction_id``.
    txn = (
        db.query(TransactionState)
        .filter_by(transaction_id=transaction_id)
        .one_or_none()
    )
    if txn is None:
        txn = TransactionState(
            transaction_id=transaction_id,
            paytm_payment_id=entity_id,
            failure_class=int(failure_class),
            current_state=TransactionLifecycleState.PENDING,
            merchant_id=merchant_id,
            customer_contact=customer_contact,
            amount_minor=entity.get("amount", 0),
            currency=entity.get("currency", "INR"),
        )
        db.add(txn)
    else:
        txn.failure_class = int(failure_class)
    db.commit()

    record_audit(
        db,
        transaction_id=transaction_id,
        node_name=NodeName.INGEST,
        action_type=ActionType.STATE_TRANSITION,
        payload={
            "event": "WEBHOOK_INGESTED",
            "event_type": event_type,
            "error_code": error_code,
            "failure_class": int(failure_class),
        },
        outcome=Outcome.SUCCESS,
    )

    # Hand the transaction to the recovery DAG: diagnose -> gate -> intervene.
    graph = build_recovery_graph(deps)
    graph.invoke(
        {
            "transaction_id": transaction_id,
            "telemetry": {"event_type": event_type, "error_code": error_code},
        }
    )

    txn = db.query(TransactionState).filter_by(transaction_id=transaction_id).one()
    return {
        "status": "ingested",
        "transaction_id": transaction_id,
        "failure_class": int(failure_class),
        "current_state": txn.current_state.value,
    }
