"""Shared test fixtures.

Each test gets an isolated in-memory SQLite database via a ``get_db`` override,
so tests never touch the real ``recovery_engine.db``.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app import models as _models  # noqa: F401  (register models on Base.metadata)


class _FakeDiagnosis:
    """Offline diagnosis engine for tests: picks the deterministic per-class
    default playbook, so webhook orchestration never calls the live model."""

    def diagnose(self, *, failure_class, telemetry=None, user_message=None):
        from app.services.diagnosis import Diagnosis, _DEFAULT_PLAYBOOK

        return Diagnosis(root_cause="TEST", recommended_playbook=_DEFAULT_PLAYBOOK[failure_class])


@pytest.fixture()
def db_session():
    # StaticPool + shared in-memory connection so the schema persists for the
    # lifetime of the test across sessions.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_orchestrator_deps():
        from app.adapters.dispatcher import build_dispatcher
        from app.orchestrator.graph import OrchestratorDeps
        from app.services.policy_sandbox import PolicySandbox

        return OrchestratorDeps(
            db=db_session,
            diagnosis=_FakeDiagnosis(),
            sandbox=PolicySandbox.from_default_policy(),
            dispatch=build_dispatcher(db_session, live_mode=False),
        )

    from app.orchestrator.factory import get_orchestrator_deps
    from app.routers.assistant import get_assistant_generate

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_orchestrator_deps] = override_orchestrator_deps
    # Keep the assistant offline in tests → deterministic keyword parser, no network.
    app.dependency_overrides[get_assistant_generate] = lambda: None
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
