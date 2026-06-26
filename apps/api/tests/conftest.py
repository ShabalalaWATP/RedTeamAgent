from __future__ import annotations

from collections.abc import Generator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.database import engine
from app.infrastructure.db.models import Base
from app.interfaces.api.dependencies import expensive_limiter, login_limiter
from app.main import create_app


@pytest.fixture(autouse=True)
def clean_database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Generator[None]:
    monkeypatch.chdir(tmp_path)
    login_limiter.hits.clear()
    expensive_limiter.hits.clear()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client() -> Generator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


def register_verified(client: TestClient, email: str = "owner@example.com") -> dict[str, Any]:
    password = "Correct-Horse-42!"  # noqa: S105 - deterministic test password
    registered = client.post("/auth/register", json={"email": email, "password": password})
    assert registered.status_code == 200, registered.text
    token = registered.json()["verification_token"]
    verified = client.post("/auth/verify-email", json={"token": token})
    assert verified.status_code == 204, verified.text
    logged_in = client.post("/auth/login", json={"email": email, "password": password})
    assert logged_in.status_code == 200, logged_in.text
    body = logged_in.json()
    return {
        "email": email,
        "password": password,
        "workspace_id": body["workspace"]["id"],
        "csrf": body["csrf_token"],
        "user_id": body["user"]["id"],
    }


def csrf_headers(auth: dict[str, Any]) -> dict[str, str]:
    return {"X-CSRF-Token": str(auth["csrf"])}
