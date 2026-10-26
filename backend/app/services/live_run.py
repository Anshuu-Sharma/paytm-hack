"""Live recovery run — REX working a flagged case in front of the user.

Streams the agent loop step by step (diagnose → message → read the reply → maybe
call → reconcile) so a viewer watches REX recover a payment, rather than seeing
pre-baked data. Reuses the real services: the customer's reply is scripted (any
demo scripts the counterparty), but REX's outbound message is drafted live by
Gemini and every decision — stopping rules, Hinglish P2P extraction, reconcile —
is real code. Each yielded (event, data) is framed as SSE by the router; `pause`
paces the run (injected as a no-op in tests).
"""

from __future__ import annotations

import time
from typing import Callable, Iterator

from sqlalchemy.orm import Session

from app.enums import (
    ActionType,
    CallSpeaker,
    CallStatus,
    InterventionChannel,
    MessageDirection,
    MessageSender,
    MessageStatus,
    NodeName,
    Outcome,
    StoppingRule,
    TransactionLifecycleState,
)
from app.models import CallSession, CallTurn, Message, TransactionState
from app.services.audit import record_audit
from app.services.conversations import build_call, persona_for
from app.services.drafting import draft_message
from app.services.escalation import enqueue_escalation
from app.services.nlp import extract_p2p_date
from app.services.reconciliation import compute_metrics
from app.services.stopping_rules import screen_user_message

Event = tuple[str, dict]

# Deterministic per-class diagnosis (root cause, canonical Playbook key, confidence).
# The playbook is the enum key — not a prose phrase — so the frontend localizes it
# through the same vocab dictionary it uses for seeded diagnoses.
_DIAG: dict[int, tuple[str, str, float]] = {
    1: ("ACQUIRER_SWITCH_TIMEOUT", "REROUTE_RAIL", 0.94),
    2: ("OTP_3DS_DROPPED", "UPI_AUTOPAY_NUDGE", 0.88),
    3: ("BALANCE_BEFORE_SALARY", "SALARY_CYCLE_SEQUENCER", 0.91),
    4: ("BUYER_AP_CYCLE", "P2P_TRACKER", 0.85),
}

_LABEL = {1: "Failed Payment", 2: "Abandoned Checkout", 3: "Failed Subscription", 4: "Overdue Invoice"}

_FIRST_MSG_PROMPT = {
    1: "Write the first WhatsApp message: a brief technical glitch on our side caused this payment to fail — reassure it's not their fault and offer a secure 1-tap link, no OTP needed.",
    2: "Write the first WhatsApp message: their checkout dropped at the OTP/3DS step; offer a 1-tap UPI Autopay link to finish instantly.",
    3: "Write the first WhatsApp message: their subscription auto-debit failed due to a low balance before salary; reassure you'll retry around their salary date.",
    4: "Write the first WhatsApp message: their B2B invoice is overdue; politely ask when you can expect the payment.",
}


def _customer_reply(run_outcome: str, persona: dict) -> str:
    if run_outcome == "optout":
        return "please stop messaging me, band karo"
    if run_outcome == "dispute":
        return "yeh galat invoice hai, humne itna order nahi kiya tha"
    if run_outcome == "p2p":
        return persona["p2p"]
    return persona["ok"]


def _ser_msg(m: Message) -> dict:
    return {
        "id": m.id,
        "channel": m.channel.value,
        "direction": m.direction.value,
        "sender": m.sender.value,
        "body": m.body,
        "status": m.status.value,
        "seq": m.seq,
        "meta": m.meta_json,
        "created_at": m.created_at.isoformat(),
    }


def run_recovery(
    db: Session,
    transaction_id: str,
    *,
    pause: Callable[[float], None] = time.sleep,
    drafter: Callable[[Session, str, str], str] | None = None,
    locale: str = "en",
) -> Iterator[Event]:
    # Default drafter writes in the requested locale (Hindi → Devanagari message);
    # tests inject their own offline drafter and keep the (db, tid, prompt) contract.
    if drafter is None:
        drafter = lambda d, t, p: draft_message(d, t, p, locale=locale)  # noqa: E731
    txn = db.query(TransactionState).filter_by(transaction_id=transaction_id).one_or_none()
    if txn is None:
        raise ValueError(f"Unknown transaction: {transaction_id!r}")

    fc = int(txn.failure_class)
    meta = dict(txn.metadata_json or {})
    persona = persona_for(txn.id or 0)
    run_outcome = meta.get("run_outcome", "recovered")
    name = str(meta.get("customer_name") or "there")
    first = name.split()[0]
    rupees = f"₹{int(txn.amount_minor / 100):,}"

    last = (
        db.query(Message)
        .filter_by(transaction_id=transaction_id)
        .order_by(Message.seq.desc())
        .first()
    )
    seq = (last.seq + 1) if last else 0

    def add_msg(direction, sender, body, mj=None) -> Message:
        nonlocal seq
        m = Message(
            transaction_id=transaction_id, channel=InterventionChannel.WHATSAPP,
            direction=direction, sender=sender, body=body, status=MessageStatus.READ,
            seq=seq, meta_json=mj,
        )
        db.add(m)
        db.commit()
        db.refresh(m)
        seq += 1
        return m

    yield "start", {
        "transaction_id": transaction_id,
        "failure_class": fc,
        "amount_inr": round(txn.amount_minor / 100, 2),
        "customer_name": name,
    }
    pause(0.5)

    # 1) Flag / ingest
    txn.current_state = TransactionLifecycleState.DIAGNOSING
    db.commit()
    record_audit(db, transaction_id=transaction_id, node_name=NodeName.INGEST,
                 action_type=ActionType.STATE_TRANSITION,
                 payload={"event": "FLAGGED", "class": _LABEL[fc]}, outcome=Outcome.SUCCESS)
    yield "step", {"phase": "flagged", "label": f"Flagged: {_LABEL[fc]} · {rupees}"}
    pause(0.8)

    # 2) Diagnose
    root, playbook, conf = _DIAG[fc]
    record_audit(db, transaction_id=transaction_id, node_name=NodeName.DIAGNOSE,
                 action_type=ActionType.STATE_TRANSITION,
                 payload={"root_cause": root, "recommended_playbook": playbook, "confidence": conf},
                 outcome=Outcome.SUCCESS)
    yield "diagnosis", {"root_cause": root, "playbook": playbook, "confidence": conf}
    pause(1.0)

    # 3) REX composes + sends the WhatsApp (drafted live by Gemini)
    yield "typing", {"who": "agent"}
    pause(1.1)
    body = drafter(db, transaction_id, _FIRST_MSG_PROMPT[fc])
    m = add_msg(MessageDirection.OUTBOUND, MessageSender.AGENT, body, {"ai_drafted": True})
    txn.current_state = TransactionLifecycleState.INTERVENING
    db.commit()
    record_audit(db, transaction_id=transaction_id, node_name=NodeName.EXECUTE_INTERVENTION,
                 action_type=ActionType.INTERVENTION_DISPATCH,
                 payload={"action": "SEND_WHATSAPP", "channel": "WHATSAPP", "playbook": playbook},
                 outcome=Outcome.SUCCESS)
    yield "message", _ser_msg(m)
    pause(1.2)

    # 4) Customer replies (scripted counterparty)
    yield "typing", {"who": "customer"}
    pause(1.4)
    reply = _customer_reply(run_outcome, persona)
    yield "message", _ser_msg(add_msg(MessageDirection.INBOUND, MessageSender.CUSTOMER, reply))
    pause(0.8)

    # 5) REX reacts — real decision code off the actual reply text
    terminal: str | None = None
    verdict = screen_user_message(reply)
    if verdict.disposition == "TERMINATE":
        terminal = "CANCELLED"
        _stop(db, transaction_id, verdict.rule, verdict.reason)
        add_msg(MessageDirection.OUTBOUND, MessageSender.SYSTEM,
                f"Opt-out honoured — all contact stopped ({verdict.rule.value}).")
        yield "step", {"phase": "stopped", "rule": verdict.rule.value}
    elif verdict.disposition == "ESCALATE":
        terminal = "ESCALATED"
        enqueue_escalation(db, transaction_id=transaction_id, reason=verdict.reason, rule=verdict.rule)
        _stop(db, transaction_id, verdict.rule, verdict.reason)
        add_msg(MessageDirection.OUTBOUND, MessageSender.SYSTEM,
                f"Dispute raised — automation frozen, escalated to a human ({verdict.rule.value}).")
        yield "step", {"phase": "escalated", "rule": verdict.rule.value}
    elif fc == 4 and run_outcome == "p2p":
        p2p = extract_p2p_date(reply)
        if p2p:
            meta["p2p_date"] = p2p
            record_audit(db, transaction_id=transaction_id, node_name=NodeName.WAIT,
                         action_type=ActionType.RETRY_SCHEDULED,
                         payload={"reason": "WAITING_FOR_P2P", "scheduled_for": p2p, "extracted_from": reply},
                         outcome=Outcome.SUCCESS)
            yield "message", _ser_msg(add_msg(
                MessageDirection.OUTBOUND, MessageSender.AGENT,
                f"Noted — we'll expect payment by {p2p}. I'll hold reminders until then. Thank you!",
                {"p2p_date": p2p}))
            yield "step", {"phase": "waiting", "p2p_date": p2p}
    pause(1.0)

    # 6) AI voice call where the class calls for it (mandate refresh)
    if fc == 3 and terminal is None:
        yield "step", {"phase": "calling"}
        pause(0.8)
        cb = build_call(failure_class=fc, name=name, amount_inr=txn.amount_minor / 100, persona=persona)
        session = CallSession(transaction_id=transaction_id, status=CallStatus.COMPLETED,
                              duration_sec=cb.duration_sec, outcome=cb.outcome, provider="simulated")
        db.add(session)
        db.flush()
        for t in cb.turns:
            db.add(CallTurn(call_session_id=session.id, speaker=t.speaker, text=t.text,
                            seq=t.at_offset_sec, at_offset_sec=t.at_offset_sec))
        db.commit()
        yield "call", {"id": session.id, "duration_sec": cb.duration_sec, "turns": len(cb.turns)}
        pause(1.0)

    # 7) Reconcile
    if terminal is None:
        txn.current_state = TransactionLifecycleState.RECOVERED
        record_audit(db, transaction_id=transaction_id, node_name=NodeName.RECONCILE,
                     action_type=ActionType.STATE_TRANSITION,
                     payload={"outcome_event": "payment.captured", "disposition": "RECOVERED"},
                     outcome=Outcome.SUCCESS)
        add_msg(MessageDirection.OUTBOUND, MessageSender.SYSTEM, f"Payment of {rupees} received ✓")
        final = "RECOVERED"
    else:
        txn.current_state = TransactionLifecycleState(terminal)
        final = terminal

    meta["unworked"] = False
    txn.metadata_json = meta
    db.commit()

    yield "status", {"final_state": final}
    yield "complete", {"final_state": final, "metrics": compute_metrics(db)}


def _stop(db: Session, transaction_id: str, rule: StoppingRule, reason: str) -> None:
    record_audit(db, transaction_id=transaction_id, node_name=NodeName.RECONCILE,
                 action_type=ActionType.STATE_TRANSITION,
                 payload={"stopping_rule": rule.value, "reason": reason}, outcome=Outcome.SUCCESS)
