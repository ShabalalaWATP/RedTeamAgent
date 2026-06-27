from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.infrastructure.db import enterprise_models as _enterprise_models
from app.infrastructure.db.models import Base

_ = _enterprise_models


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
    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(bind=engine)
    upgrade_site_account_schema()


def upgrade_site_account_schema() -> None:
    columns = {column["name"] for column in inspect(engine).get_columns("users")}
    additions = {
        "account_type": "VARCHAR(20) NOT NULL DEFAULT 'user'",
        "account_status": "VARCHAR(20) NOT NULL DEFAULT 'active'",
        "status_message": "TEXT NOT NULL DEFAULT ''",
        "admin_scope": "VARCHAR(20) NOT NULL DEFAULT 'none'",
        "admin_managed_user_ids": _json_column_default(),
        "last_login_at": "TIMESTAMP WITH TIME ZONE",
        "last_login_ip": "VARCHAR(64)",
        "last_seen_at": "TIMESTAMP WITH TIME ZONE",
        "last_seen_ip": "VARCHAR(64)",
    }
    missing = [(name, definition) for name, definition in additions.items() if name not in columns]
    with engine.begin() as connection:
        for name, definition in missing:
            connection.execute(text(f"ALTER TABLE users ADD COLUMN {name} {definition}"))
        connection.execute(
            text(
                "UPDATE users SET account_type = 'owner' "
                "WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1) "
                "AND NOT EXISTS (SELECT 1 FROM users WHERE account_type = 'owner')"
            )
        )


def _json_column_default() -> str:
    if engine.dialect.name == "postgresql":
        return "JSON NOT NULL DEFAULT '[]'::json"
    return "JSON NOT NULL DEFAULT '[]'"


def get_db() -> Generator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
