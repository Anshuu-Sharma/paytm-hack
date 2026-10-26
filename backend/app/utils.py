"""Small shared helpers."""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Timezone-aware current UTC timestamp.

    Centralised so every model uses the same source. Paired with
    ``DateTime(timezone=True)`` columns to keep timestamps unambiguous even
    though SQLite stores them without an offset during local development.
    """
    return datetime.now(timezone.utc)
