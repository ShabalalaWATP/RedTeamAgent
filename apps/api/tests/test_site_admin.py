from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from tests.conftest import csrf_headers, register_verified


def test_owner_can_manage_accounts_and_block_suspended_login(client: TestClient) -> None:
    owner = register_verified(client, "owner@example.com")
    user_client = TestClient(client.app)
    user = register_verified(user_client, "user@example.com")

    users = client.get("/site-admin/users")
    assert users.status_code == 200, users.text
    assert users.json()[0]["account_type"] == "user"
    assert any(row["account_type"] == "owner" for row in users.json())

    suspended = client.put(
        f"/site-admin/users/{user['user_id']}",
        headers=csrf_headers(owner),
        json={
            "account_status": "suspended",
            "status_message": "Your account is under manual review.",
        },
    )
    assert suspended.status_code == 200, suspended.text
    assert suspended.json()["account_status"] == "suspended"

    blocked = user_client.post("/auth/login", json={"email": user["email"], "password": user["password"]})
    assert blocked.status_code == 401
    assert blocked.json()["message"] == "Your account is under manual review."

    deleted = client.delete(f"/site-admin/users/{user['user_id']}", headers=csrf_headers(owner))
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["account_status"] == "deleted"


def test_owner_controls_admin_scope_and_visits(client: TestClient) -> None:
    owner = register_verified(client, "owner-scope@example.com")
    admin_client = TestClient(client.app)
    admin = register_verified(admin_client, "admin@example.com")
    managed_client = TestClient(client.app)
    managed = register_verified(managed_client, "managed@example.com")
    other_client = TestClient(client.app)
    other = register_verified(other_client, "other@example.com")

    promoted = client.put(
        f"/site-admin/users/{admin['user_id']}",
        headers=csrf_headers(owner),
        json={
            "account_type": "admin",
            "admin_scope": "selected",
            "admin_managed_user_ids": [managed["user_id"]],
        },
    )
    assert promoted.status_code == 200, promoted.text
    assert promoted.json()["account_type"] == "admin"

    visible = admin_client.get("/site-admin/users")
    assert visible.status_code == 200, visible.text
    assert [row["email"] for row in visible.json()] == [managed["email"]]

    blocked = admin_client.put(
        f"/site-admin/users/{other['user_id']}",
        headers=csrf_headers(admin),
        json={"account_status": "suspended"},
    )
    assert blocked.status_code == 403

    allowed = admin_client.put(
        f"/site-admin/users/{managed['user_id']}",
        headers=csrf_headers(admin),
        json={"account_status": "banned", "status_message": "Access revoked."},
    )
    assert allowed.status_code == 200, allowed.text
    assert allowed.json()["account_status"] == "banned"

    anonymous_visit = client.post("/site-admin/visits", json={"path": "/auth"})
    assert anonymous_visit.status_code == 204
    signed_visit = admin_client.post("/site-admin/visits", json={"path": "/settings"})
    assert signed_visit.status_code == 204
    scoped_visits = admin_client.get("/site-admin/visits")
    assert scoped_visits.status_code == 200
    assert "/auth" not in {visit["path"] for visit in scoped_visits.json()}
    visits = client.get("/site-admin/visits")
    assert visits.status_code == 200
    assert {visit["path"] for visit in visits.json()} >= {"/auth", "/settings"}


def test_all_scope_admin_visit_telemetry_excludes_privileged_and_anonymous_rows(client: TestClient) -> None:
    owner = register_verified(client, "visit-owner@example.com")
    admin_client = TestClient(client.app)
    admin = register_verified(admin_client, "visit-admin@example.com")
    peer_admin_client = TestClient(client.app)
    peer_admin = register_verified(peer_admin_client, "visit-peer-admin@example.com")
    user_client = TestClient(client.app)
    register_verified(user_client, "visit-user@example.com")

    for target in (admin, peer_admin):
        promoted = client.put(
            f"/site-admin/users/{target['user_id']}",
            headers=csrf_headers(owner),
            json={"account_type": "admin", "admin_scope": "all"},
        )
        assert promoted.status_code == 200, promoted.text

    assert client.post("/site-admin/visits", json={"path": "/owner"}).status_code == 204
    assert admin_client.post("/site-admin/visits", json={"path": "/admin"}).status_code == 204
    assert peer_admin_client.post("/site-admin/visits", json={"path": "/peer-admin"}).status_code == 204
    assert user_client.post("/site-admin/visits", json={"path": "/user"}).status_code == 204
    assert TestClient(client.app).post("/site-admin/visits", json={"path": "/anonymous"}).status_code == 204

    admin_visits = {visit["path"] for visit in admin_client.get("/site-admin/visits").json()}
    assert "/user" in admin_visits
    assert not {"/owner", "/admin", "/peer-admin", "/anonymous"} & admin_visits

    owner_visits = {visit["path"] for visit in client.get("/site-admin/visits").json()}
    assert {"/owner", "/admin", "/peer-admin", "/user", "/anonymous"} <= owner_visits


def test_anonymous_visit_tracking_is_rate_limited(client: TestClient) -> None:
    settings = Settings(site_visit_rate_limit_per_minute=2)
    client.app.dependency_overrides[get_settings] = lambda: settings

    assert client.post("/site-admin/visits", json={"path": "/auth"}).status_code == 204
    assert client.post("/site-admin/visits", json={"path": "/workflows"}).status_code == 204
    blocked = client.post("/site-admin/visits", json={"path": "/settings"})

    assert blocked.status_code == 429
    assert blocked.json()["message"] == "Too many requests. Try again later."
    client.app.dependency_overrides.clear()
