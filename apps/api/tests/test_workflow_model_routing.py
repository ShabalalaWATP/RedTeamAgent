from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from tests.conftest import csrf_headers, register_verified
from tests.test_stage1_api import create_project_review


def test_production_run_requires_verified_model_route(client: TestClient) -> None:
    client.app.dependency_overrides[get_settings] = lambda: Settings(
        expose_auth_tokens=True,
        auto_bootstrap_site_owner=True,
        allow_fake_provider=False,
    )
    auth = register_verified(client, "missing-provider-route@example.com")
    ids = create_project_review(client, auth)
    source = client.post(
        f"/reviews/{ids['review_id']}/sources/text",
        headers=csrf_headers(auth),
        json={"text": "Evidence is ready but no production provider is configured."},
    )
    assert source.status_code == 200

    preflight = client.get(f"/reviews/{ids['review_id']}/preflight")
    assert preflight.status_code == 200, preflight.text
    assert preflight.json()["fallback_routes"][0]["to"] == "blocked"

    run = client.post(f"/reviews/{ids['review_id']}/runs", headers=csrf_headers(auth))
    assert run.status_code == 422
    assert "Configure and verify a production AI provider" in run.json()["message"]

    workflows = client.get(f"/workspaces/{auth['workspace_id']}/workflows")
    assert workflows.status_code == 200
    assert workflows.json() == []


def test_saved_provider_route_runs_when_fake_provider_is_disabled(client: TestClient) -> None:
    client.app.dependency_overrides[get_settings] = lambda: Settings(
        expose_auth_tokens=True,
        auto_bootstrap_site_owner=True,
        allow_fake_provider=False,
    )
    auth = register_verified(client, "saved-provider-route@example.com")
    ids = create_project_review(client, auth)
    source = client.post(
        f"/reviews/{ids['review_id']}/sources/text",
        headers=csrf_headers(auth),
        json={"text": "Evidence: saved provider route should execute the review."},
    )
    assert source.status_code == 200

    connection = client.post(
        "/providers/connections",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "adapter": "approved_gateway",
            "name": "Approved gateway",
            "config": {},
            "credentials": {},
        },
    )
    assert connection.status_code == 200, connection.text
    synced = client.post(
        f"/providers/connections/{connection.json()['id']}/models/sync",
        headers=csrf_headers(auth),
    )
    assert synced.status_code == 200, synced.text
    profile = client.post(
        "/providers/profiles",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "name": "Saved review model",
            "agent_key": "cybersecurity_privacy",
            "model_record_id": synced.json()[0]["id"],
            "explicit_pin": True,
        },
    )
    assert profile.status_code == 200, profile.text

    run = client.post(f"/reviews/{ids['review_id']}/runs", headers=csrf_headers(auth))
    assert run.status_code == 200, run.text
    completed = client.get(f"/runs/{run.json()['id']}")
    assert completed.json()["state"] == "completed"
    assert completed.json()["usage"]["provider"] == "approved_gateway"
    assert completed.json()["usage"]["model_identifier"] == "approved_gateway-default"
    assert completed.json()["usage"]["model_profile"] == "Saved review model"


def test_verified_model_must_be_selected_before_production_run(client: TestClient) -> None:
    client.app.dependency_overrides[get_settings] = lambda: Settings(
        expose_auth_tokens=True,
        auto_bootstrap_site_owner=True,
        allow_fake_provider=False,
    )
    auth = register_verified(client, "unselected-provider-route@example.com")
    ids = create_project_review(client, auth)
    source = client.post(
        f"/reviews/{ids['review_id']}/sources/text",
        headers=csrf_headers(auth),
        json={"text": "Evidence: a synced model is available but has not been selected."},
    )
    assert source.status_code == 200

    connection = _create_approved_gateway(client, auth)
    synced = client.post(
        f"/providers/connections/{connection['id']}/models/sync",
        headers=csrf_headers(auth),
    )
    assert synced.status_code == 200, synced.text
    assert synced.json()[0]["verified"] is True

    run = client.post(f"/reviews/{ids['review_id']}/runs", headers=csrf_headers(auth))
    assert run.status_code == 422
    assert "Configure and verify a production AI provider" in run.json()["message"]


def test_select_model_sets_single_active_review_profile(client: TestClient) -> None:
    auth = register_verified(client, "select-provider-route@example.com")
    connection = _create_approved_gateway(client, auth)
    synced = client.post(
        f"/providers/connections/{connection['id']}/models/sync",
        headers=csrf_headers(auth),
    )
    assert synced.status_code == 200, synced.text

    selected = client.post(
        f"/providers/models/{synced.json()[0]['id']}/select",
        headers=csrf_headers(auth),
    )
    assert selected.status_code == 200, selected.text
    assert selected.json()["name"] == "Active review model"
    assert selected.json()["agent_key"] == "default"

    profiles = client.get(f"/providers/profiles?workspace_id={auth['workspace_id']}")
    assert profiles.status_code == 200, profiles.text
    active_profiles = [item for item in profiles.json() if item["agent_key"] == "default"]
    assert len(active_profiles) == 1
    assert active_profiles[0]["model_record_id"] == synced.json()[0]["id"]


def _create_approved_gateway(client: TestClient, auth: dict[str, str]) -> dict[str, object]:
    response = client.post(
        "/providers/connections",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "adapter": "approved_gateway",
            "name": "Approved gateway",
            "config": {},
            "credentials": {},
        },
    )
    assert response.status_code == 200, response.text
    return response.json()
