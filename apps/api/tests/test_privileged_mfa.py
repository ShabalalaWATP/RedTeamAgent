from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from webauthn.helpers import bytes_to_base64url

from tests.conftest import csrf_headers, register_verified


def test_owner_must_complete_authenticator_and_passkey_before_app_access(client: TestClient) -> None:
    auth = register_verified(client, "privileged-mfa@example.com", complete_privileged_mfa=False)

    me = client.get("/auth/me")
    assert me.status_code == 200, me.text
    assert me.json()["mfa_setup_required"] is True

    blocked = client.get(f"/projects?workspace_id={auth['workspace_id']}")
    assert blocked.status_code == 401
    assert blocked.json()["code"] == "mfa_setup_required"

    setup = client.post("/auth/mfa/setup", headers=csrf_headers(auth))
    assert setup.status_code == 200, setup.text

    passkey_status = client.get("/auth/passkeys/status")
    assert passkey_status.status_code == 200, passkey_status.text
    assert passkey_status.json()["required"] is True
    assert passkey_status.json()["registered"] is False

    options = client.post("/auth/passkeys/registration/options", headers=csrf_headers(auth))
    assert options.status_code == 200, options.text
    assert options.json()["options"]["rp"]["name"] == "RedTeamAgent"
    assert options.json()["options"]["authenticatorSelection"]["userVerification"] == "required"


def test_privileged_accounts_cannot_disable_authenticator_mfa(client: TestClient) -> None:
    auth = register_verified(client, "privileged-disable@example.com")

    disabled = client.post("/auth/mfa/disable", headers=csrf_headers(auth), json={"code": "000000"})

    assert disabled.status_code == 403
    assert disabled.json()["message"] == "Owner and admin accounts must keep authenticator-app MFA enabled."


def test_privileged_accounts_cannot_delete_last_required_passkey(client: TestClient) -> None:
    auth = register_verified(client, "privileged-last-passkey@example.com")
    status = client.get("/auth/passkeys/status")
    passkey_id = status.json()["credentials"][0]["id"]

    deleted = client.delete(f"/auth/passkeys/{passkey_id}", headers=csrf_headers(auth))

    assert deleted.status_code == 409
    assert deleted.json()["message"] == "Owner and admin accounts must keep at least one passkey."


def test_passkey_registration_and_authentication_routes_verify_session(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    auth = register_verified(client, "privileged-passkey-routes@example.com", complete_privileged_mfa=False)

    registration_options = client.post("/auth/passkeys/registration/options", headers=csrf_headers(auth))
    assert registration_options.status_code == 200, registration_options.text
    monkeypatch.setattr(
        "app.application.passkey_service.verify_registration_response",
        lambda **_: SimpleNamespace(
            credential_id=b"route-credential",
            credential_public_key=b"public-key",
            sign_count=1,
            aaguid="route-aaguid",
        ),
    )
    registered = client.post(
        "/auth/passkeys/registration/verify",
        headers=csrf_headers(auth),
        json={"credential": {"rawId": "ignored", "response": {"transports": ["internal"]}}, "name": "Laptop"},
    )
    assert registered.status_code == 204, registered.text

    authentication_options = client.post("/auth/passkeys/authentication/options", headers=csrf_headers(auth))
    assert authentication_options.status_code == 200, authentication_options.text
    monkeypatch.setattr(
        "app.application.passkey_service.verify_authentication_response",
        lambda **_: SimpleNamespace(credential_id=b"route-credential", new_sign_count=2),
    )
    verified = client.post(
        "/auth/passkeys/authentication/verify",
        headers=csrf_headers(auth),
        json={"credential": {"rawId": bytes_to_base64url(b"route-credential")}},
    )
    assert verified.status_code == 204, verified.text
