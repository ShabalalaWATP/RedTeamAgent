from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.infrastructure.db.models import Base


def _connect_args(database_url: str) -> dict[str, object]:
    if database_url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


settings = get_settings()
_engine_kwargs: dict[str, object] = {"connect_args": _connect_args(settings.database_url)}
if settings.database_url == "sqlite+pysqlite:///:memory:":
    _engine_kwargs["poolclass"] = StaticPool
engine = create_engine(settings.database_url, **_engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def initialise_database() -> None:
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
