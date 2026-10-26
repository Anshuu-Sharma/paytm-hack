"""LangGraph node implementations.

Each node advances one transaction through the recovery DAG, and every node that
takes an action does so *through the Bouncer*: the PolicySandbox and stopping
rules sit inside ``execute`` and ``ingest`` respectively, so nothing dispatches
without clearing deterministic policy. Nodes own their own DB writes (state
transition + audit) so the durable record always matches the graph's progress.
"""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING, Any, Callable

from langgraph.graph import END

from app.enums import (
    ActionType,
    FailureClass,
    InterventionAction,
    InterventionChannel,
    NodeName,
    Outcome,
    Playbook,
    TransactionLifecycleState,
)
from app.models import TransactionState
from app.orchestrator.state import RecoveryState
from app.services.audit import record_audit
from app.services.escalation import enqueue_escalation
from app.services.policy_sandbox import ProposedAction
from app.services.stopping_rules import retry_cap_exceeded, screen_user_message

if TYPE_CHECKING:  # pragma: no cover
    from app.orchestrator.graph import OrchestratorDeps

_RECOVERY_OUTCOMES = {"payment.captured", "payment.authorized"}

# How each playbook is carried out - the concrete action and channel the
# execute node proposes to the Bouncer.
_PLAYBOOK_ACTION: dict[Playbook, tuple[InterventionAction, InterventionChannel | None]] = {
    Playbook.REROUTE_RAIL: (InterventionAction.GENERATE_PAYMENT_LINK, InterventionChannel.PAYMENT_LINK),
    Playbook.PREAUTH_LINK: (InterventionAction.GENERATE_PAYMENT_LINK, InterventionChannel.PAYMENT_LINK),
    Playbook.UPI_AUTOPAY_NUDGE: (InterventionAction.SEND_WHATSAPP, InterventionChannel.WHATSAPP),
    Playbook.NEGOTIATION: (InterventionAction.OFFER_FEE_WAIVER, InterventionChannel.WHATSAPP),
    Playbook.SALARY_CYCLE_SEQUENCER: (InterventionAction.RETRY_CHARGE, None),
    Playbook.MANDATE_REFRESH: (InterventionAction.VOICE_CALL, InterventionChannel.VOICE),
    Playbook.P2P_TRACKER: (InterventionAction.SEND_WHATSAPP, InterventionChannel.WHATSAPP),
}


def _txn(deps: "OrchestratorDeps", transaction_id: str) -> TransactionState:
    return deps.db.query(TransactionState).filter_by(transaction_id=transaction_id).one()


def _finalize(deps, transaction_id, disposition, node_name, payload, outcome) -> None:
    """Write the terminal lifecycle state and its audit entry."""
    txn = _txn(deps, transaction_id)
    txn.current_state = TransactionLifecycleState(disposition)
    deps.db.commit()
    record_audit(
        deps.db,
        transaction_id=transaction_id,
        node_name=node_name,
        action_type=ActionType.STATE_TRANSITION,
        payload=payload,
        outcome=outcome,
    )


def _next_salary_window(today: date) -> str:
    """The next universal salary-credit date (1st of the applicable month)."""
    if today.day <= 5:
        return today.replace(day=1).isoformat()
    year = today.year + (today.month == 12)
    month = 1 if today.month == 12 else today.month + 1
    return date(year, month, 1).isoformat()


def build_nodes(deps: "OrchestratorDeps") -> dict[str, Callable[[RecoveryState], dict[str, Any]]]:
    def ingest(state: RecoveryState) -> dict[str, Any]:
        transaction_id = state["transaction_id"]
        txn = _txn(deps, transaction_id)
        txn.current_state = TransactionLifecycleState.DIAGNOSING
        deps.db.commit()
        record_audit(
            deps.db,
            transaction_id=transaction_id,
            node_name=NodeName.INGEST,
            action_type=ActionType.STATE_TRANSITION,
            payload={"event": "ORCHESTRATION_STARTED", "to": "DIAGNOSING"},
            outcome=Outcome.SUCCESS,
        )

        # Deterministic opt-out / dispute guard, applied before any diagnosis so
        # a STOP is honoured regardless of what the LLM would say.
        message = state.get("user_message")
        if message:
            verdict = screen_user_message(message)
            if verdict.disposition == "TERMINATE":
                _finalize(
                    deps, transaction_id, "CANCELLED", NodeName.INGEST,
                    {"stopping_rule": verdict.rule.value, "reason": verdict.reason},
                    Outcome.SUCCESS,
                )
                return {"disposition": "CANCELLED", "stopping_rule": verdict.rule.value}
            if verdict.disposition == "ESCALATE":
                enqueue_escalation(
                    deps.db, transaction_id=transaction_id, reason=verdict.reason, rule=verdict.rule
                )
                _finalize(
                    deps, transaction_id, "ESCALATED", NodeName.INGEST,
                    {"stopping_rule": verdict.rule.value, "reason": verdict.reason},
                    Outcome.ESCALATED,
                )
                return {"disposition": "ESCALATED", "stopping_rule": verdict.rule.value}

        return {
            "failure_class": int(txn.failure_class),
            "retry_count": txn.retry_count,
            "lifecycle": TransactionLifecycleState.DIAGNOSING.value,
        }

    def diagnose(state: RecoveryState) -> dict[str, Any]:
        transaction_id = state["transaction_id"]
        diagnosis = deps.diagnosis.diagnose(
            failure_class=FailureClass(state["failure_class"]),
            telemetry=state.get("telemetry", {}),
            user_message=state.get("user_message"),
        )
        record_audit(
            deps.db,
            transaction_id=transaction_id,
            node_name=NodeName.DIAGNOSE,
            action_type=ActionType.STATE_TRANSITION,
            payload={
                "root_cause": diagnosis.root_cause,
                "recommended_playbook": diagnosis.recommended_playbook.value,
                "confidence": diagnosis.confidence,
            },
            outcome=Outcome.SUCCESS,
        )
        return {
            "playbook": diagnosis.recommended_playbook.value,
            "root_cause": diagnosis.root_cause,
            "proposed_discount_pct": diagnosis.proposed_discount_pct,
        }

    def wait(state: RecoveryState) -> dict[str, Any]:
        transaction_id = state["transaction_id"]
        txn = _txn(deps, transaction_id)
        txn.current_state = TransactionLifecycleState.WAITING
        deps.db.commit()
        scheduled_for = _next_salary_window(date.today())
        record_audit(
            deps.db,
            transaction_id=transaction_id,
            node_name=NodeName.WAIT,
            action_type=ActionType.RETRY_SCHEDULED,
            payload={"reason": "SALARY_CYCLE_DEFERRAL", "scheduled_for": scheduled_for},
            outcome=Outcome.SUCCESS,
        )
        return {"lifecycle": TransactionLifecycleState.WAITING.value}

    def execute(state: RecoveryState) -> dict[str, Any]:
        transaction_id = state["transaction_id"]
        txn = _txn(deps, transaction_id)
        playbook = Playbook(state["playbook"])
        action_type, channel = _PLAYBOOK_ACTION[playbook]

        # RBI retry cap is enforced before proposing another auto-debit.
        if action_type == InterventionAction.RETRY_CHARGE and retry_cap_exceeded(
            state.get("retry_count", 0)
        ):
            _finalize(
                deps, transaction_id, "CANCELLED", NodeName.EXECUTE_INTERVENTION,
                {"stopping_rule": "RBI_MAX_RETRIES"}, Outcome.SUCCESS,
            )
            return {"disposition": "CANCELLED", "stopping_rule": "RBI_MAX_RETRIES"}

        action = ProposedAction(
            action=action_type,
            channel=channel,
            discount_pct=state.get("proposed_discount_pct"),
            amount_minor=txn.amount_minor,
        )
        decision = deps.sandbox.validate(action)
        if not decision.approved:
            enqueue_escalation(deps.db, transaction_id=transaction_id, reason=decision.reason)
            _finalize(
                deps, transaction_id, "ESCALATED", NodeName.EXECUTE_INTERVENTION,
                {"policy_block": decision.reason, "action": action.action_value},
                Outcome.ESCALATED,
            )
            return {"disposition": "ESCALATED"}

        txn.current_state = TransactionLifecycleState.INTERVENING
        deps.db.commit()
        deps.dispatch(action, state)
        record_audit(
            deps.db,
            transaction_id=transaction_id,
            node_name=NodeName.EXECUTE_INTERVENTION,
            action_type=ActionType.INTERVENTION_DISPATCH,
            payload={
                "action": action.action_value,
                "channel": action.channel_value,
                "playbook": playbook.value,
            },
            outcome=Outcome.SUCCESS,
        )
        return {"lifecycle": TransactionLifecycleState.INTERVENING.value}

    def reconcile(state: RecoveryState) -> dict[str, Any]:
        transaction_id = state["transaction_id"]
        outcome_event = state.get("outcome_event")
        if outcome_event in _RECOVERY_OUTCOMES:
            _finalize(
                deps, transaction_id, "RECOVERED", NodeName.RECONCILE,
                {"outcome_event": outcome_event, "disposition": "RECOVERED"},
                Outcome.SUCCESS,
            )
            return {"disposition": "RECOVERED"}

        # No settlement yet: the intervention has been dispatched and we are
        # awaiting the customer/bank. The transaction stays INTERVENING (set in
        # execute) rather than being marked a failure prematurely.
        record_audit(
            deps.db,
            transaction_id=transaction_id,
            node_name=NodeName.RECONCILE,
            action_type=ActionType.STATE_TRANSITION,
            payload={"event": "AWAITING_OUTCOME", "outcome_event": outcome_event},
            outcome=Outcome.SUCCESS,
        )
        return {"disposition": None}

    return {"ingest": ingest, "diagnose": diagnose, "wait": wait, "execute": execute, "reconcile": reconcile}


# --- Routing (pure functions over state) -------------------------------------

def route_after_ingest(state: RecoveryState) -> str:
    return END if state.get("disposition") else "diagnose"


def route_after_diagnose(state: RecoveryState) -> str:
    return "wait" if state.get("playbook") == Playbook.SALARY_CYCLE_SEQUENCER.value else "execute"


def route_after_execute(state: RecoveryState) -> str:
    return END if state.get("disposition") else "reconcile"
