"""Class-specific operational trackers over the real transaction store.

Class 3 (subscriptions) and Class 4 (receivables) get a domain view on top of the
same ``TransactionState`` rows REX already works: a mandate/renewal calendar and
a receivables-aging board. Schedule fields (next debit, salary date, due date,
promise-to-pay) live in ``metadata_json`` — carried explicitly on rows created
here, and derived deterministically for seeded rows that predate them — so a new
subscription or invoice is a genuine at-risk case REX can recover, not a mock.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.enums import FailureClass, TransactionLifecycleState
from app.models import TransactionState
from app.utils import utcnow

_RUNNABLE = {
    TransactionLifecycleState.PENDING,
    TransactionLifecycleState.DIAGNOSING,
    TransactionLifecycleState.INTERVENING,
    TransactionLifecycleState.WAITING,
}

# Mandate status shown on the calendar, per lifecycle state.
_MANDATE_STATUS = {
    TransactionLifecycleState.PENDING: "at_risk",
    TransactionLifecycleState.DIAGNOSING: "at_risk",
    TransactionLifecycleState.WAITING: "deferred",       # salary-cycle sequencer
    TransactionLifecycleState.INTERVENING: "retrying",
    TransactionLifecycleState.RECOVERED: "recovered",
    TransactionLifecycleState.FAILED: "failed",
    TransactionLifecycleState.CANCELLED: "cancelled",
    TransactionLifecycleState.ESCALATED: "escalated",
}

_PLANS = ["Rooh Pro", "Rooh Team", "Rooh Studio", "Rooh Plus"]


def _d(iso: str | None) -> date | None:
    return date.fromisoformat(iso) if iso else None


def _iso(d: date) -> str:
    return d.isoformat()


# --- subscriptions (Class 3) ------------------------------------------------

# A debit's date must agree with its status: what's already Paid (or failed) is in
# the past; what's Pending / Deferred / Retrying is upcoming. Derived dates follow
# this so a future debit can never read as "recovered".
_SUB_PAST = {"recovered", "failed", "cancelled", "escalated"}


def _sub_offset(txn_id: int, status: str) -> int:
    if status in _SUB_PAST:
        return -(5 + txn_id % 25)          # already happened
    if status == "retrying":
        return 1 + txn_id % 5              # retry imminent
    if status == "deferred":
        return 3 + txn_id % 12             # deferred to the salary window
    return 2 + txn_id % 20                 # at_risk / active → upcoming


def _subscription_view(txn: TransactionState, today: date) -> dict:
    meta = txn.metadata_json or {}
    salary_day = int(meta.get("salary_day", 1))
    status = meta.get("mandate_status") or _MANDATE_STATUS.get(txn.current_state, "active")
    # Explicit on rows we created; derived rows land on a status-consistent date.
    next_debit = _d(meta.get("next_debit_date")) or today + timedelta(days=_sub_offset(txn.id, status))
    return {
        "transaction_id": txn.transaction_id,
        "serial": txn.id,
        "customer_name": meta.get("customer_name"),
        "plan": meta.get("plan") or _PLANS[txn.id % len(_PLANS)],
        "amount_inr": round(txn.amount_minor / 100, 2),
        "cycle": meta.get("cycle", "monthly"),
        "next_debit_date": _iso(next_debit),
        "salary_day": salary_day,
        "mandate_status": status,
        "retry_count": txn.retry_count,
        "retry_cap": 3,
        "predicted_fail": bool(meta.get("is_at_risk", True)) and txn.current_state in _RUNNABLE,
        "status": txn.current_state.value,
    }


def list_subscriptions(db: Session) -> list[dict]:
    today = utcnow().date()
    rows = (
        db.query(TransactionState)
        .filter(TransactionState.failure_class == int(FailureClass.SUBSCRIPTION_MANDATE))
        .all()
    )
    views = [_subscription_view(t, today) for t in rows]
    views.sort(key=lambda v: v["next_debit_date"])
    return views


def create_subscription(
    db: Session, *, customer_name: str, plan: str, amount_inr: float,
    next_debit_date: str, salary_day: int = 1,
) -> dict:
    txn = _make_txn(db, FailureClass.SUBSCRIPTION_MANDATE, customer_name, amount_inr, {
        "subscription": True,
        "plan": plan,
        "cycle": "monthly",
        "next_debit_date": next_debit_date,
        "salary_day": salary_day,
        "mandate_status": "at_risk",
    })
    return _subscription_view(txn, utcnow().date())


# --- invoices (Class 4) -----------------------------------------------------

def _aging_bucket(days_overdue: int) -> str:
    if days_overdue <= 0:
        return "current"
    if days_overdue <= 30:
        return "0-30"
    if days_overdue <= 60:
        return "30-60"
    if days_overdue <= 90:
        return "60-90"
    return "90+"


def _inv_category(status: str, p2p) -> str:
    if status == "RECOVERED":
        return "paid"
    if p2p or status in ("INTERVENING", "WAITING"):
        return "sent"
    return "pending"


def _inv_offset(txn_id: int, category: str) -> int:
    # Paid / being-chased invoices are overdue (past). Pending splits between
    # current (not yet due, future) and overdue-but-unactioned (past).
    if category == "paid":
        return -(10 + txn_id % 50)
    if category == "sent":
        return -(5 + txn_id % 80)
    return (5 + txn_id % 20) if txn_id % 2 == 0 else -(5 + txn_id % 70)


def _invoice_view(txn: TransactionState, today: date) -> dict:
    meta = txn.metadata_json or {}
    p2p = meta.get("p2p_date")
    category = _inv_category(txn.current_state.value, p2p)
    # Explicit on rows we created; derived rows land on a status-consistent due date.
    due = _d(meta.get("due_date")) or today + timedelta(days=_inv_offset(txn.id, category))
    issue = _d(meta.get("issue_date")) or due - timedelta(days=30)
    days_overdue = (today - due).days
    # Next reminder: the promise date if given, else a few days out.
    next_reminder = p2p or _iso(today + timedelta(days=3))
    return {
        "transaction_id": txn.transaction_id,
        "serial": txn.id,
        "buyer_name": meta.get("customer_name"),
        "invoice_no": meta.get("invoice_no") or f"INV-{txn.id:04d}",
        "amount_inr": round(txn.amount_minor / 100, 2),
        "issue_date": _iso(issue),
        "due_date": _iso(due),
        "terms": meta.get("terms", "NET30"),
        "days_overdue": days_overdue,
        "aging_bucket": _aging_bucket(days_overdue),
        "p2p_date": p2p,
        "next_reminder_date": next_reminder,
        "status": txn.current_state.value,
        "open": txn.current_state in _RUNNABLE,
    }


def list_invoices(db: Session) -> list[dict]:
    today = utcnow().date()
    rows = (
        db.query(TransactionState)
        .filter(TransactionState.failure_class == int(FailureClass.B2B_RECEIVABLES))
        .all()
    )
    views = [_invoice_view(t, today) for t in rows]
    views.sort(key=lambda v: v["due_date"])
    return views


def create_invoice(
    db: Session, *, buyer_name: str, amount_inr: float, issue_date: str, due_date: str,
    terms: str = "NET30",
) -> dict:
    txn = _make_txn(db, FailureClass.B2B_RECEIVABLES, buyer_name, amount_inr, {
        "invoice": True,
        "issue_date": issue_date,
        "due_date": due_date,
        "terms": terms,
    })
    return _invoice_view(txn, utcnow().date())


# --- shared creation --------------------------------------------------------

def _make_txn(db: Session, fc: FailureClass, name: str, amount_inr: float, extra: dict) -> TransactionState:
    """Create a real, unworked at-risk case REX can recover, tagged for a tracker."""
    txn = TransactionState(
        transaction_id=f"txn_{int(fc)}_{uuid.uuid4().hex[:8]}",
        paytm_payment_id=f"pay_{uuid.uuid4().hex[:10]}",
        failure_class=int(fc),
        current_state=TransactionLifecycleState.PENDING,
        merchant_id="merch_rooh",
        customer_contact="+919900000000",
        amount_minor=int(round(amount_inr * 100)),
        currency="INR",
        metadata_json={
            "customer_name": name,
            "is_at_risk": True,
            "ai_tag": "RECOVERY_CASE",
            "unworked": True,
            "run_outcome": "recovered",
            "archetype": f"CLASS_{int(fc)}",
            **extra,
        },
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn
