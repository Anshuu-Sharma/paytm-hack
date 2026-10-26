"""Live telemetry stream (SSE) for Mission Control.

`GET /stream/demo/{failure_class}` synthesises a representative at-risk
transaction and runs it through the recovery DAG, emitting one Server-Sent Event
per audit entry as the graph executes node-by-node (via LangGraph's native
streaming), then a terminal `complete` event carrying the metrics snapshot.

The flow is strictly server -> client, so SSE (native EventSource, auto-reconnect,
no extra deps) is the right transport. Event contract:
  event: start    data: {transaction_id, failure_class, amount_minor}
  event: audit    data: {node_name, action_type, payload, outcome, timestamp, lifecycle}
  event: complete data: {transaction_id, final_state, metrics}
"""

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.enums import FailureClass
from app.models import AuditTrail, TransactionState
from app.orchestrator.factory import get_orchestrator_deps
from app.orchestrator.graph import OrchestratorDeps, build_recovery_graph
from app.services.reconciliation import compute_metrics
from app.services.scenarios import synthesize

router = APIRouter(prefix="/stream", tags=["stream"])

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",  # disable proxy buffering so events flush immediately
}


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


@router.get("/demo/{failure_class}")
def stream_demo(
    failure_class: int,
    db: Session = Depends(get_db),
    deps: OrchestratorDeps = Depends(get_orchestrator_deps),
):
    try:
        fc = FailureClass(failure_class)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown failure class: {failure_class}",
        )

    scenario = synthesize(fc)
    db.add(scenario.to_transaction_state())
    db.commit()

    graph = build_recovery_graph(deps)
    initial_state = scenario.to_initial_state()

    def event_stream():
        yield _sse(
            "start",
            {
                "transaction_id": scenario.transaction_id,
                "failure_class": int(fc),
                "amount_minor": scenario.amount_minor,
            },
        )

        last_audit_id = 0
        # Drive the DAG with LangGraph's streaming iterator; after each step,
        # flush any audit rows the just-run node appended.
        for _ in graph.stream(initial_state):
            current = (
                db.query(TransactionState)
                .filter_by(transaction_id=scenario.transaction_id)
                .one()
            )
            new_rows = (
                db.query(AuditTrail)
                .filter(
                    AuditTrail.transaction_id == scenario.transaction_id,
                    AuditTrail.id > last_audit_id,
                )
                .order_by(AuditTrail.id)
                .all()
            )
            for row in new_rows:
                last_audit_id = row.id
                yield _sse(
                    "audit",
                    {
                        "node_name": row.node_name.value,
                        "action_type": row.action_type.value,
                        "payload": row.payload,
                        "outcome": row.outcome.value,
                        "timestamp": row.timestamp.isoformat(),
                        "lifecycle": current.current_state.value,
                    },
                )

        final = (
            db.query(TransactionState)
            .filter_by(transaction_id=scenario.transaction_id)
            .one()
        )
        yield _sse(
            "complete",
            {
                "transaction_id": scenario.transaction_id,
                "final_state": final.current_state.value,
                "metrics": compute_metrics(db),
            },
        )

    return StreamingResponse(
        event_stream(), media_type="text/event-stream", headers=_SSE_HEADERS
    )
