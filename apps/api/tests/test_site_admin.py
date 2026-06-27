from __future__ import annotations

from fastapi.testclient import TestClient

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
    visits = client.get("/site-admin/visits")
    assert visits.status_code == 200
    assert {visit["path"] for visit in visits.json()} >= {"/auth", "/settings"}
