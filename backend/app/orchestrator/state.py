"""The orchestrator's working state.

Deliberately JSON-serialisable (no ORM objects, no sessions) so the LangGraph
SQLite checkpointer can persist it and resume a paused workflow after a restart -
the durable multi-day wait state the PRD calls for. Durable domain data lives in
the TransactionState/AuditTrail tables; this dict is just the in-flight graph
context.
"""

from typing import Any, Optional, TypedDict


class RecoveryState(TypedDict, total=False):
    transaction_id: str
    failure_class: int
    telemetry: dict[str, Any]
    user_message: Optional[str]

    lifecycle: str            # current TransactionLifecycleState value
    playbook: Optional[str]   # Playbook value chosen by diagnosis
    root_cause: Optional[str]
    retry_count: int
    # Advisory concession from diagnosis; must clear the sandbox in execute.
    proposed_discount_pct: Optional[float]

    # A settlement/outcome signal fed to the reconcile node (e.g. "payment.captured").
    outcome_event: Optional[str]

    # Terminal bookkeeping.
    disposition: Optional[str]   # RECOVERED | CANCELLED | ESCALATED | FAILED
    stopping_rule: Optional[str]
