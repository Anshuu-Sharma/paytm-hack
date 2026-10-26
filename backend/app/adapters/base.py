"""Shared adapter result type.

Every channel adapter returns a ``DispatchResult``. The ``simulated`` flag is
what lets the same code path run live for a single scripted demo and simulated
for the 50-webhook batch, and it is recorded so the audit trail always shows
whether an action really left the building.
"""

from dataclasses import dataclass


@dataclass
class DispatchResult:
    channel: str
    delivered: bool
    simulated: bool
    reference: str | None = None
    detail: str | None = None
