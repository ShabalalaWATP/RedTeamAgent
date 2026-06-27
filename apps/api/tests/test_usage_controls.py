from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.core.database import SessionLocal
from app.infrastructure.db import models
from tests.conftest import csrf_headers, register_verified


def test_login_honours_secure_cookie_setting(client: TestClient) -> None:
    settings = Settings(expose_auth_tokens=True, auto_bootstrap_site_owner=True, cookie_secure=True)
    client.app.dependency_overrides[get_settings] = lambda: settings

    password = "Correct-Horse-42!"  # noqa: S105 - deterministic test password
    registered = client.post("/auth/register", json={"email": "secure@example.com", "password": password})
    assert registered.status_code == 200, registered.text
    verified = client.post("/auth/verify-email", json={"token": registered.json()["verification_token"]})
    assert verified.status_code == 204, verified.text

    logged_in = client.post("/auth/login", json={"email": "secure@example.com", "password": password})
    assert logged_in.status_code == 200, logged_in.text
    assert "rta_session=" in logged_in.headers["set-cookie"]
    assert "Secure" in logged_in.headers["set-cookie"]

    client.app.dependency_overrides.clear()


def test_project_quota_applies_by_account_type(client: TestClient) -> None:
    settings = Settings(
        expose_auth_tokens=True,
        auto_bootstrap_site_owner=True,
        user_project_limit=1,
        admin_usage_multiplier=3,
    )
    client.app.dependency_overrides[get_settings] = lambda: settings

    owner = register_verified(client, "owner-quota@example.com")
    assert _create_project(client, owner, "Owner one").status_code == 200
    assert _create_project(client, owner, "Owner two").status_code == 200

    auth = register_verified(client, "quota@example.com")
    assert _create_project(client, auth, "User one").status_code == 200
    blocked = _create_project(client, auth, "User two")
    assert blocked.status_code == 429
    assert "User project limit reached (1)" in blocked.json()["message"]

    _set_account_type(auth["user_id"], "admin")
    assert _create_project(client, auth, "Admin two").status_code == 200
    assert _create_project(client, auth, "Admin three").status_code == 200
    admin_blocked = _create_project(client, auth, "Admin four")
    assert admin_blocked.status_code == 429
    assert "Admin project limit reached (3)" in admin_blocked.json()["message"]

    client.app.dependency_overrides.clear()


def test_workflow_storage_limit_is_freed_by_deleting_workflow(client: TestClient) -> None:
    settings = Settings(
        expose_auth_tokens=True,
        auto_bootstrap_site_owner=True,
        user_workflow_total_limit=1,
        user_workflow_weekly_limit=2,
    )
    client.app.dependency_overrides[get_settings] = lambda: settings
    register_verified(client, "workflow-owner@example.com")
    auth = register_verified(client, "workflow-user@example.com")
    review = _create_standalone_review(client, auth)

    usage_before = client.get("/usage/limits")
    assert usage_before.status_code == 200, usage_before.text
    assert usage_before.json()["workflows_remaining"] == 1
    assert usage_before.json()["weekly_workflows_remaining"] == 2

    first_run = client.post(f"/reviews/{review['id']}/runs", headers=csrf_headers(auth))
    assert first_run.status_code == 200, first_run.text
    storage_blocked = client.post(f"/reviews/{review['id']}/runs", headers=csrf_headers(auth))
    assert storage_blocked.status_code == 429
    assert "workflow storage limit reached (1)" in storage_blocked.json()["message"]

    deleted = client.delete(f"/runs/{first_run.json()['id']}", headers=csrf_headers(auth))
    assert deleted.status_code == 204, deleted.text
    second_run = client.post(f"/reviews/{review['id']}/runs", headers=csrf_headers(auth))
    assert second_run.status_code == 200, second_run.text

    usage_after = client.get("/usage/limits")
    assert usage_after.status_code == 200, usage_after.text
    assert usage_after.json()["workflows_remaining"] == 0
    assert usage_after.json()["weekly_workflows_remaining"] == 0

    client.app.dependency_overrides.clear()


def test_weekly_workflow_limit_survives_deleted_runs(client: TestClient) -> None:
    settings = Settings(
        expose_auth_tokens=True,
        auto_bootstrap_site_owner=True,
        user_workflow_total_limit=5,
        user_workflow_weekly_limit=1,
    )
    client.app.dependency_overrides[get_settings] = lambda: settings
    register_verified(client, "weekly-owner@example.com")
    auth = register_verified(client, "weekly-user@example.com")
    review = _create_standalone_review(client, auth)

    first_run = client.post(f"/reviews/{review['id']}/runs", headers=csrf_headers(auth))
    assert first_run.status_code == 200, first_run.text
    deleted = client.delete(f"/runs/{first_run.json()['id']}", headers=csrf_headers(auth))
    assert deleted.status_code == 204, deleted.text

    blocked = client.post(f"/reviews/{review['id']}/runs", headers=csrf_headers(auth))
    assert blocked.status_code == 429
    assert "weekly workflow limit reached (1)" in blocked.json()["message"]

    client.app.dependency_overrides.clear()


def _create_project(client: TestClient, auth: dict[str, object], title: str):
    return client.post(
        "/projects",
        headers=csrf_headers(auth),
        json={"workspace_id": auth["workspace_id"], "title": title, "description": ""},
    )


def _create_standalone_review(client: TestClient, auth: dict[str, object]) -> dict[str, object]:
    response = client.post(
        "/reviews",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "title": "Quota review",
            "proposal_text": "Spend carefully.",
            "mode": "basic",
            "focus_chips": [],
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["project_id"] is None
    return body


def _set_account_type(user_id: str, account_type: str) -> None:
    with SessionLocal() as session:
        user = session.get(models.User, user_id)
        assert user is not None
        user.account_type = account_type
        session.commit()
