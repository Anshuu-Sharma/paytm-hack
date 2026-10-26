"""The recovery DAG.

    Ingest -> Diagnose -> (Wait ->) Execute -> Reconcile

with two early exits: the opt-out/dispute guard can terminate at Ingest, and a
policy block can terminate at Execute. Compiling with a SQLite checkpointer makes
the Wait state durable, so a workflow paused for a salary cycle resumes after a
restart instead of being lost.
"""

from dataclasses import dataclass
from typing import Callable

from langgraph.graph import END, START, StateGraph
from sqlalchemy.orm import Session

from app.orchestrator import nodes as node_defs
from app.orchestrator.state import RecoveryState
from app.services.diagnosis import DiagnosisEngine
from app.services.policy_sandbox import PolicySandbox


@dataclass
class OrchestratorDeps:
    """Everything the graph needs to reach the outside world.

    Injected rather than imported so the orchestrator is testable offline: tests
    pass a fake diagnosis engine and a recording dispatcher, while production
    wires the Gemini engine and the live/sim channel dispatcher.
    """

    db: Session
    diagnosis: DiagnosisEngine
    sandbox: PolicySandbox
    dispatch: Callable  # (ProposedAction, RecoveryState) -> dispatch result


def build_recovery_graph(deps: OrchestratorDeps, checkpointer=None):
    nodes = node_defs.build_nodes(deps)

    builder = StateGraph(RecoveryState)
    for name, fn in nodes.items():
        builder.add_node(name, fn)

    builder.add_edge(START, "ingest")
    builder.add_conditional_edges(
        "ingest", node_defs.route_after_ingest, {"diagnose": "diagnose", END: END}
    )
    builder.add_conditional_edges(
        "diagnose", node_defs.route_after_diagnose, {"wait": "wait", "execute": "execute"}
    )
    builder.add_edge("wait", "execute")
    builder.add_conditional_edges(
        "execute", node_defs.route_after_execute, {"reconcile": "reconcile", END: END}
    )
    builder.add_edge("reconcile", END)

    return builder.compile(checkpointer=checkpointer)
