from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import csrf_headers, register_verified
from tests.test_stage1_api import create_project_review


def test_cross_workspace_idor_matrix(client: TestClient) -> None:
    owner = register_verified(client, "matrix-owner@example.com")
    resources = _seed_workspace(client, owner)

    other_client = TestClient(client.app)
    attacker = register_verified(other_client, "matrix-attacker@example.com")

    denied = [
        other_client.get(f"/projects?workspace_id={owner['workspace_id']}"),
        other_client.post(
            "/projects",
            headers=csrf_headers(attacker),
            json={"workspace_id": owner["workspace_id"], "title": "stolen", "description": ""},
        ),
        other_client.put(
            f"/projects/{resources['project_id']}",
            headers=csrf_headers(attacker),
            json={"title": "stolen", "description": ""},
        ),
        other_client.delete(f"/projects/{resources['project_id']}", headers=csrf_headers(attacker)),
        other_client.get(f"/projects/{resources['project_id']}/reviews"),
        other_client.post(
            f"/projects/{resources['project_id']}/reviews",
            headers=csrf_headers(attacker),
            json={"title": "stolen", "proposal_text": "stolen", "mode": "basic", "focus_chips": []},
        ),
        other_client.post(
            f"/reviews/{resources['review_id']}/sources/text",
            headers=csrf_headers(attacker),
            json={"text": "stolen"},
        ),
        other_client.post(
            f"/reviews/{resources['review_id']}/sources/upload",
            headers=csrf_headers(attacker),
            files={"file": ("stolen.txt", b"stolen", "text/plain")},
        ),
        other_client.get(f"/reviews/{resources['review_id']}/preflight"),
        other_client.get(f"/context-packs?workspace_id={owner['workspace_id']}"),
        other_client.post(
            "/context-packs",
            headers=csrf_headers(attacker),
            json={
                "workspace_id": owner["workspace_id"],
                "name": "stolen",
                "agent_key": "policy_governance",
                "markdown": "stolen",
            },
        ),
        other_client.get(f"/providers/connections?workspace_id={owner['workspace_id']}"),
        other_client.post(
            "/providers/connections",
            headers=csrf_headers(attacker),
            json={
                "workspace_id": owner["workspace_id"],
                "adapter": "fake",
                "name": "stolen",
                "config": {},
                "credentials": {},
            },
        ),
        other_client.post(
            f"/providers/connections/{resources['connection_id']}/test",
            headers=csrf_headers(attacker),
        ),
        other_client.post(
            f"/providers/connections/{resources['connection_id']}/models/sync",
            headers=csrf_headers(attacker),
        ),
        other_client.get(f"/providers/models?workspace_id={owner['workspace_id']}"),
        other_client.post(
            "/providers/models",
            headers=csrf_headers(attacker),
            json={
                "workspace_id": owner["workspace_id"],
                "provider_connection_id": resources["connection_id"],
                "model_identifier": "stolen",
                "capabilities": ["text"],
            },
        ),
        other_client.post(f"/providers/models/{resources['model_id']}/probe", headers=csrf_headers(attacker)),
        other_client.get(f"/providers/profiles?workspace_id={owner['workspace_id']}"),
        other_client.post(
            "/providers/profiles",
            headers=csrf_headers(attacker),
            json={
                "workspace_id": owner["workspace_id"],
                "name": "stolen",
                "agent_key": "policy_governance",
                "model_record_id": resources["model_id"],
            },
        ),
        other_client.post(f"/reviews/{resources['review_id']}/runs", headers=csrf_headers(attacker)),
        other_client.get(f"/runs/{resources['run_id']}"),
        other_client.post(f"/runs/{resources['run_id']}/cancel", headers=csrf_headers(attacker)),
        other_client.get(f"/runs/{resources['run_id']}/events"),
        other_client.get(f"/runs/{resources['run_id']}/events/stream"),
        other_client.get(f"/runs/{resources['run_id']}/report"),
        other_client.get(f"/runs/{resources['run_id']}/report/export?fmt=json"),
        other_client.get(f"/workspaces/{owner['workspace_id']}/workflows"),
    ]

    for response in denied:
        assert response.status_code == 403, response.text


def _seed_workspace(client: TestClient, auth: dict[str, Any]) -> dict[str, str]:
    ids = create_project_review(client, auth)
    source = client.post(
        f"/reviews/{ids['review_id']}/sources/text",
        headers=csrf_headers(auth),
        json={"text": "Evidence for matrix test."},
    )
    assert source.status_code == 200, source.text

    pack = client.post(
        "/context-packs",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "name": "Matrix policy",
            "agent_key": "policy_governance",
            "markdown": "# Matrix",
        },
    )
    assert pack.status_code == 200, pack.text

    connection = client.post(
        "/providers/connections",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "adapter": "fake",
            "name": "Fake",
            "config": {},
            "credentials": {},
        },
    )
    assert connection.status_code == 200, connection.text

    model = client.post(
        "/providers/models",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "provider_connection_id": connection.json()["id"],
            "model_identifier": "fake",
            "capabilities": ["text"],
        },
    )
    assert model.status_code == 200, model.text

    profile = client.post(
        "/providers/profiles",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "name": "Fake profile",
            "agent_key": "policy_governance",
            "model_record_id": model.json()["id"],
        },
    )
    assert profile.status_code == 200, profile.text

    run = client.post(f"/reviews/{ids['review_id']}/runs", headers=csrf_headers(auth))
    assert run.status_code == 200, run.text
    return {
        **ids,
        "connection_id": connection.json()["id"],
        "model_id": model.json()["id"],
        "profile_id": profile.json()["id"],
        "run_id": run.json()["id"],
    }
