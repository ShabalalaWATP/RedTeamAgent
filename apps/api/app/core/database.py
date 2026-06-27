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
    upgrade_workflow_quota_schema()


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


def upgrade_workflow_quota_schema() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "projects" in table_names:
        project_columns = {column["name"] for column in inspector.get_columns("projects")}
        with engine.begin() as connection:
            if "created_by_user_id" not in project_columns:
                connection.execute(text("ALTER TABLE projects ADD COLUMN created_by_user_id VARCHAR(36)"))
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_projects_created_by_user_id ON projects (created_by_user_id)")
            )
    if "reviews" in table_names and engine.dialect.name == "postgresql":
        review_columns = {column["name"]: column for column in inspector.get_columns("reviews")}
        project_column = review_columns.get("project_id")
        if project_column and not project_column.get("nullable", True):
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE reviews ALTER COLUMN project_id DROP NOT NULL"))


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
