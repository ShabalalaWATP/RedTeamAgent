from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import initialise_database
from app.interfaces.api.errors import install_error_handlers
from app.interfaces.api.routes import auth, projects, providers, reviews, runs


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    initialise_database()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="RedTeamAgent API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type", "X-CSRF-Token"],
    )
    install_error_handlers(app)
    app.include_router(auth.router)
    app.include_router(projects.router)
    app.include_router(reviews.router)
    app.include_router(providers.router)
    app.include_router(runs.router)

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
