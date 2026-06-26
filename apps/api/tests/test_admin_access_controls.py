from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import csrf_headers, register_verified


def test_auth_response_includes_workspace_owner_role(client: TestClient) -> None:
    password = "Correct-Horse-42!"  # noqa: S105 - deterministic test password
    registered = client.post("/auth/register", json={"email": "role-owner@example.com", "password": password})
    assert registered.status_code == 200, registered.text
    assert registered.json()["workspace_role"] == "owner"
    verified = client.post("/auth/verify-email", json={"token": registered.json()["verification_token"]})
    assert verified.status_code == 204, verified.text

    logged_in = client.post("/auth/login", json={"email": "role-owner@example.com", "password": password})
    assert logged_in.status_code == 200, logged_in.text
    assert logged_in.json()["workspace_role"] == "owner"


def test_workspace_member_cannot_access_admin_settings(client: TestClient) -> None:
    owner = register_verified(client, "admin-owner@example.com")
    organisation = client.post(
        "/enterprise/workspaces",
        headers=csrf_headers(owner),
        json={"name": "Admin Boundary"},
    )
    assert organisation.status_code == 200, organisation.text
    workspace_id = organisation.json()["id"]
    provider = client.post(
        "/providers/connections",
        headers=csrf_headers(owner),
        json={
            "workspace_id": workspace_id,
            "adapter": "fake",
            "name": "Admin fake",
            "config": {"scenario": "valid"},
            "credentials": {},
        },
    )
    assert provider.status_code == 200, provider.text

    invite = client.post(
        f"/enterprise/workspaces/{workspace_id}/invitations",
        headers=csrf_headers(owner),
        json={"email": "settings-member@example.com", "role": "member"},
    )
    assert invite.status_code == 200, invite.text
    member_client = TestClient(client.app)
    member = register_verified(member_client, "settings-member@example.com")
    accepted = member_client.post(
        "/enterprise/invitations/accept",
        headers=csrf_headers(member),
        json={"token": invite.json()["token"]},
    )
    assert accepted.status_code == 200, accepted.text

    assert member_client.get(f"/providers/connections?workspace_id={workspace_id}").status_code == 403
    tested = member_client.post(
        f"/providers/connections/{provider.json()['id']}/test",
        headers=csrf_headers(member),
    )
    assert tested.status_code == 403
    assert member_client.get(f"/providers/models?workspace_id={workspace_id}").status_code == 403
    assert member_client.get(f"/providers/profiles?workspace_id={workspace_id}").status_code == 403
    assert member_client.get(f"/enterprise/workspaces/{workspace_id}/governance").status_code == 403
    assert member_client.get(f"/enterprise/workspaces/{workspace_id}/members").status_code == 403
    assert member_client.get(f"/enterprise/workspaces/{workspace_id}/model-comparison").status_code == 403
