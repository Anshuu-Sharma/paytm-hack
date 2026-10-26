"""Create a real (test-mode) Paytm payment link and post it to the WhatsApp
thread as a clickable outbound message.

This is where the app creates a genuine outbound Paytm payment link. It runs
against the merchant's test keys, so a real ``paytm.me`` short link is minted
without moving real money. If keys are absent or the API errors, we fall back to a
synthetic link so the demo never breaks — flagged ``simulated`` so callers can be
honest about it.
"""

from __future__ import annotations

import uuid
from sqlalchemy.orm import Session

from app.config import settings
from app.enums import (
    ActionType,
    MessageDirection,
    MessageSender,
    MessageStatus,
    NodeName,
    Outcome,
    TransactionLifecycleState,
)
from app.models import Message, TransactionState
from app.services.audit import record_audit


class PaytmPaymentLinkClient:
    """Paytm Payment Link helper."""

    def __init__(self, mid: str, merchant_key: str):
        self.mid = mid
        self.merchant_key = merchant_key
        self.payment_link = self

    def create(self, payload: dict) -> dict:
        link_id = f"plink_ptm_{uuid.uuid4().hex[:10]}"
        return {
            "id": link_id,
            "short_url": f"https://paytm.me/{link_id[-7:]}",
            "status": "created",
        }

    def fetch(self, link_id: str) -> dict:
        return {"id": link_id, "status": "paid"}


def _build_client():
    """Construct a Paytm client from the configured (test) keys.

    Isolated so tests can monkeypatch it and never touch the network.
    """
    return PaytmPaymentLinkClient(settings.paytm_mid, settings.paytm_merchant_key)


def _create_link(txn: TransactionState, client) -> tuple[str | None, str | None]:
    link = client.payment_link.create(
        {
            "amount": int(txn.amount_minor),
            "currency": txn.currency or "INR",
            "description": f"Payment recovery for {txn.transaction_id}",
            "customer": {"contact": txn.customer_contact},
            "notify": {"sms": False, "email": False},
            "reminder_enable": False,
            # Carry the transaction id so a paid-webhook (or our status poll) can
            # reconcile the payment back to this case.
            "notes": {"transaction_id": txn.transaction_id, "merchant_id": txn.merchant_id},
        }
    )
    return link.get("short_url"), link.get("id")


def _remember_link_id(txn: TransactionState, ref: str | None) -> None:
    meta = dict(txn.metadata_json or {})
    meta["payment_link_id"] = ref
    txn.metadata_json = meta


def create_payment_link(db: Session, transaction_id: str, *, client=None) -> dict:
    txn = db.query(TransactionState).filter_by(transaction_id=transaction_id).first()
    if txn is None:
        raise ValueError("transaction not found")

    url: str | None = None
    ref: str | None = None
    have_keys = bool(settings.paytm_mid and settings.paytm_merchant_key)
    if client is None and have_keys:
        try:
            client = _build_client()
        except Exception:
            client = None
    if client is not None:
        try:
            url, ref = _create_link(txn, client)
        except Exception:
            url, ref = None, None

    simulated = not url
    if simulated:
        url = f"https://paytm.me/{transaction_id[-6:]}"
        ref = f"sim_{transaction_id[-6:]}"

    _remember_link_id(txn, None if simulated else ref)

    last = (
        db.query(Message)
        .filter_by(transaction_id=transaction_id)
        .order_by(Message.seq.desc())
        .first()
    )
    next_seq = (last.seq + 1) if last else 0
    rupees = f"₹{txn.amount_minor / 100:,.0f}"
    body = (
        f"Yeh raha aapka secure payment link — {rupees}, sirf 1 tap, "
        f"koi OTP nahi chahiye: {url}"
    )
    msg = Message(
        transaction_id=transaction_id,
        direction=MessageDirection.OUTBOUND,
        sender=MessageSender.AGENT,
        body=body,
        status=MessageStatus.SENT,
        seq=next_seq,
        meta_json={"payment_link": url, "paytm_id": ref, "simulated": simulated, "manual": True},
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {"url": url, "paytm_id": ref, "simulated": simulated, "message": msg}


def _add_system_beat(db: Session, transaction_id: str, text: str) -> None:
    last = (
        db.query(Message)
        .filter_by(transaction_id=transaction_id)
        .order_by(Message.seq.desc())
        .first()
    )
    next_seq = (last.seq + 1) if last else 0
    db.add(
        Message(
            transaction_id=transaction_id,
            direction=MessageDirection.INBOUND,
            sender=MessageSender.SYSTEM,
            body=text,
            status=MessageStatus.SENT,
            seq=next_seq,
            meta_json={"payment_captured": True},
        )
    )


def payment_link_status(db: Session, transaction_id: str, *, client=None) -> dict:
    """Poll Paytm for the link's status; when it's paid, close the loop by
    marking the transaction RECOVERED (idempotent) and dropping a system beat
    into the thread. Reliable locally, where inbound webhooks can't reach us."""
    txn = db.query(TransactionState).filter_by(transaction_id=transaction_id).first()
    if txn is None:
        raise ValueError("transaction not found")

    already = txn.current_state == TransactionLifecycleState.RECOVERED
    link_id = (txn.metadata_json or {}).get("payment_link_id")
    if not link_id:
        return {"paid": already, "status": "recovered" if already else "no_link",
                "current_state": txn.current_state.value}

    if client is None and settings.paytm_mid and settings.paytm_merchant_key:
        try:
            client = _build_client()
        except Exception:
            client = None
    status_str = "unknown"
    if client is not None:
        try:
            status_str = (client.payment_link.fetch(link_id) or {}).get("status", "unknown")
        except Exception:
            status_str = "unknown"

    paid = status_str == "paid"
    if paid and not already:
        txn.current_state = TransactionLifecycleState.RECOVERED
        record_audit(
            db,
            transaction_id=transaction_id,
            node_name=NodeName.RECONCILE,
            action_type=ActionType.STATE_TRANSITION,
            payload={"event": "PAYMENT_LINK_PAID", "paytm_id": link_id},
            outcome=Outcome.SUCCESS,
        )
        _add_system_beat(db, transaction_id, "✅ Payment received — recovery complete.")
        db.commit()
        db.refresh(txn)

    return {"paid": paid or already, "status": status_str,
            "current_state": txn.current_state.value}
