"""Dev-only admin endpoints.

`POST /admin/seed` rebuilds the demo dataset by running a mixed batch of at-risk
transactions through the real orchestrator. It is idempotent (clears and
rebuilds), so the dashboard can be reset to a known, populated state on demand.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.batch import seed_batch

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/seed")
def seed(db: Session = Depends(get_db)) -> dict:
    result = seed_batch(db)
    return {"seeded": result.seeded, "by_state": result.by_state}
