from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import (
    admin,
    assistant,
    health,
    metrics,
    policy,
    stream,
    trackers,
    transactions,
    webhooks,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialise the schema on startup instead of at import time, so importing
    # the app (e.g. in tests) has no database side effects.
    init_db()
    yield


app = FastAPI(
    title="REX — Revenue Execution Engine",
    description="FastAPI backend orchestrating LLM-driven payment recovery workflows.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS: explicit origins from config. A wildcard is deliberately not used
# because it is invalid in combination with credentialed requests.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1")
app.include_router(metrics.router, prefix="/api/v1")
app.include_router(stream.router, prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(policy.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(assistant.router, prefix="/api/v1")
app.include_router(trackers.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "REX (Revenue Execution Engine) API is running. Check /docs for Swagger UI."}
