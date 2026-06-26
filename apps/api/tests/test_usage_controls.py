from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from tests.conftest import csrf_headers, register_verified


def test_login_honours_secure_cookie_setting(client: TestClient) -> None:
    settings = Settings(cookie_secure=True)
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


def test_daily_review_run_limit_blocks_extra_ai_runs(client: TestClient) -> None:
    settings = Settings(daily_review_run_limit=1)
    client.app.dependency_overrides[get_settings] = lambda: settings
    auth = register_verified(client, "quota@example.com")
    project = client.post(
        "/projects",
        headers=csrf_headers(auth),
        json={"workspace_id": auth["workspace_id"], "title": "Quota", "description": ""},
    )
    assert project.status_code == 200, project.text
    review = client.post(
        f"/projects/{project.json()['id']}/reviews",
        headers=csrf_headers(auth),
        json={"title": "Quota review", "proposal_text": "Spend carefully.", "mode": "basic", "focus_chips": []},
    )
    assert review.status_code == 200, review.text

    usage_before = client.get("/usage/limits")
    assert usage_before.status_code == 200, usage_before.text
    assert usage_before.json()["runs_remaining_today"] == 1

    first_run = client.post(f"/reviews/{review.json()['id']}/runs", headers=csrf_headers(auth))
    assert first_run.status_code == 200, first_run.text
    usage_after = client.get("/usage/limits")
    assert usage_after.status_code == 200, usage_after.text
    assert usage_after.json()["runs_remaining_today"] == 0

    blocked = client.post(f"/reviews/{review.json()['id']}/runs", headers=csrf_headers(auth))
    assert blocked.status_code == 429
    assert "Daily review run limit reached" in blocked.json()["message"]

    client.app.dependency_overrides.clear()
