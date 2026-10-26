from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

# Using synchronous SQLite for simplicity during hackathon development
engine = create_engine(
    settings.database_url, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables for all registered models.

    Importing ``app.models`` ensures every model is registered on ``Base``
    before ``create_all`` runs. This is called explicitly on startup rather
    than as an import side effect. NOTE: ``create_all`` only creates missing
    tables; once the schema stabilises, migrations (Alembic) should own it.
    """
    import app.models  # noqa: F401  (registers all models on Base.metadata)

    Base.metadata.create_all(bind=engine)
