"""The live recovery run — REX working a flagged case step by step."""

import pytest

from app.enums import TransactionLifecycleState
from app.models import EscalationQueue, Message, TransactionState
from app.services.live_run import run_recovery

NOOP = lambda _s: None  # noqa: E731 — skip the pacing delays in tests


def _flagged(db, tid="run_1", fc=1, run_outcome="recovered", amount=249900):
    db.add(TransactionState(
        transaction_id=tid,
        paytm_payment_id=f"pay_{tid}",
        failure_class=fc,
        current_state=TransactionLifecycleState.PENDING,
        merchant_id="m",
        customer_contact="+919900000000",
        amount_minor=amount,
        metadata_json={"customer_name": "Aarav Mehta", "is_at_risk": True,
                       "unworked": True, "run_outcome": run_outcome},
    ))
    db.commit()


def _draft(_db, _tid, _prompt):  # offline drafter — no network in tests
    return "Hi! There was a glitch on our side — here's a secure 1-tap link to finish."


def _events(db, tid):
    return list(run_recovery(db, tid, pause=NOOP, drafter=_draft))


def test_run_streams_the_agent_loop_and_recovers(db_session):
    _flagged(db_session)
    events = _events(db_session, "run_1")
    names = [e[0] for e in events]
    assert names[0] == "start"
    assert "diagnosis" in names
    assert names.count("message") >= 2  # REX message + customer reply
    assert names[-1] == "complete"
    # REX actually recovered it.
    row = db_session.query(TransactionState).filter_by(transaction_id="run_1").one()
    assert row.current_state == TransactionLifecycleState.RECOVERED
    assert (row.metadata_json or {}).get("unworked") is False
    final = events[-1][1]
    assert final["final_state"] == "RECOVERED"
    assert "metrics" in final


def test_diagnosis_event_uses_playbook_enum_key(db_session):
    # The run feed must emit the canonical Playbook key (not a prose phrase) so the
    # frontend can localize it the same way it localizes seeded diagnoses.
    _flagged(db_session, fc=1)
    events = _events(db_session, "run_1")
    diag = next(payload for name, payload in events if name == "diagnosis")
    assert diag["playbook"] == "REROUTE_RAIL"
    # …and the audit trail records the same canonical value.
    from app.models import AuditTrail

    row = (
        db_session.query(AuditTrail)
        .filter_by(transaction_id="run_1", node_name="DIAGNOSE")
        .one()
    )
    assert row.payload["recommended_playbook"] == "REROUTE_RAIL"


def test_run_persists_the_conversation(db_session):
    _flagged(db_session)
    _events(db_session, "run_1")
    msgs = db_session.query(Message).filter_by(transaction_id="run_1").all()
    assert any(m.sender.value == "AGENT" for m in msgs)
    assert any(m.sender.value == "CUSTOMER" for m in msgs)


def test_run_optout_stops_compliantly(db_session):
    _flagged(db_session, fc=2, run_outcome="optout")
    events = _events(db_session, "run_1")
    assert events[-1][1]["final_state"] == "CANCELLED"
    row = db_session.query(TransactionState).filter_by(transaction_id="run_1").one()
    assert row.current_state == TransactionLifecycleState.CANCELLED


def test_run_dispute_escalates_and_queues(db_session):
    _flagged(db_session, fc=4, run_outcome="dispute")
    events = _events(db_session, "run_1")
    assert events[-1][1]["final_state"] == "ESCALATED"
    assert db_session.query(EscalationQueue).filter_by(transaction_id="run_1").count() == 1


def test_run_b2b_p2p_extracts_and_recovers(db_session):
    _flagged(db_session, fc=4, run_outcome="p2p", amount=8400000)
    events = _events(db_session, "run_1")
    assert any(e[0] == "step" and e[1].get("phase") == "waiting" for e in events)
    row = db_session.query(TransactionState).filter_by(transaction_id="run_1").one()
    assert (row.metadata_json or {}).get("p2p_date")


def test_run_mandate_places_a_call(db_session):
    _flagged(db_session, fc=3, run_outcome="recovered", amount=89900)
    events = _events(db_session, "run_1")
    assert any(e[0] == "call" for e in events)


def test_run_unknown_transaction_raises(db_session):
    with pytest.raises(ValueError):
        _events(db_session, "nope")
