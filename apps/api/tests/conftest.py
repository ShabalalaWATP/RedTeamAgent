from __future__ import annotations

from base64 import urlsafe_b64encode
from collections.abc import Generator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import engine
from app.infrastructure.auth.credentials import FernetCredentialVault
from app.infrastructure.auth.mfa_provider import BuiltInMfaProvider
from app.infrastructure.db import models
from app.infrastructure.db.models import Base
from app.interfaces.api.dependencies import local_rate_limit_store
from app.main import create_app


@pytest.fixture(autouse=True)
def clean_database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Generator[None]:
    monkeypatch.chdir(tmp_path)
    local_rate_limit_store.clear()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client() -> Generator[TestClient]:
    with TestClient(create_app()) as test_client:
        test_settings = Settings(expose_auth_tokens=True, auto_bootstrap_site_owner=True)
        test_client.app.dependency_overrides[get_settings] = lambda: test_settings
        yield test_client
        test_client.app.dependency_overrides.clear()


def register_verified(
    client: TestClient,
    email: str = "owner@example.com",
    *,
    complete_privileged_mfa: bool = True,
) -> dict[str, Any]:
    password = "Correct-Horse-42!"  # noqa: S105 - deterministic test password
    registered = client.post("/auth/register", json={"email": email, "password": password})
    assert registered.status_code == 200, registered.text
    token = registered.json()["verification_token"]
    verified = client.post("/auth/verify-email", json={"token": token})
    assert verified.status_code == 204, verified.text
    logged_in = client.post("/auth/login", json={"email": email, "password": password})
    assert logged_in.status_code == 200, logged_in.text
    body = logged_in.json()
    if complete_privileged_mfa and body["user"]["account_type"] in {"owner", "admin"}:
        complete_privileged_mfa_for_user(body["user"]["id"])
        body["mfa_setup_required"] = False
        body["passkey_verification_required"] = False
    return {
        "email": email,
        "password": password,
        "workspace_id": body["workspace"]["id"],
        "csrf": body["csrf_token"],
        "user_id": body["user"]["id"],
    }


def csrf_headers(auth: dict[str, Any]) -> dict[str, str]:
    return {"X-CSRF-Token": str(auth["csrf"])}


def complete_privileged_mfa_for_user(user_id: str) -> None:
    with Session(engine) as session:
        if session.get(models.UserMfaSetting, user_id) is None:
            provider = BuiltInMfaProvider()
            vault = FernetCredentialVault(Settings().app_secret_key)
            sealed_secret = vault.seal({"totp": provider.generate_totp_secret()})["totp"]
            session.add(
                models.UserMfaSetting(
                    user_id=user_id,
                    secret_ciphertext=sealed_secret,
                    recovery_code_hashes=[],
                    enabled=True,
                    enabled_at=models.utc_now(),
                )
            )
        if _passkey_count(session, user_id) == 0:
            session.add(
                models.UserPasskey(
                    user_id=user_id,
                    name="Test passkey",
                    credential_id=_base64url(f"test-passkey:{user_id}"),
                    public_key=_base64url("unused-public-key"),
                    sign_count=0,
                    transports=["internal"],
                    aaguid="test",
                )
            )
        sessions = session.scalars(select(models.SessionRecord).where(models.SessionRecord.user_id == user_id))
        for record in sessions:
            record.passkey_verified_at = models.utc_now()
        session.commit()


def _passkey_count(session: Session, user_id: str) -> int:
    statement = select(models.UserPasskey).where(models.UserPasskey.user_id == user_id)
    return len(list(session.scalars(statement)))


def _base64url(value: str) -> str:
    return urlsafe_b64encode(value.encode("utf-8")).decode("ascii").rstrip("=")
