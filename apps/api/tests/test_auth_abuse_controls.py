from __future__ import annotations

import re
from types import SimpleNamespace

from fastapi.testclient import TestClient
from starlette.datastructures import Headers

from app.core.config import Settings, get_settings
from app.domain.exceptions import ValidationFailure
from app.infrastructure.auth.mfa import current_totp
from app.interfaces.api.dependencies import captcha_verifier, client_identity
from tests.conftest import csrf_headers, register_verified


def test_captcha_required_for_registration_and_password_reset(client: TestClient) -> None:
    settings = Settings(captcha_required=True)
    client.app.dependency_overrides[get_settings] = lambda: settings
    client.app.dependency_overrides[captcha_verifier] = lambda: FakeCaptchaVerifier()

    missing = client.post("/auth/register", json={"email": "captcha@example.com", "password": "Correct-Horse-42!"})
    assert missing.status_code == 422
    assert missing.json()["message"] == "Complete the security check and try again."

    registered = client.post(
        "/auth/register",
        json={
            "email": "captcha@example.com",
            "password": "Correct-Horse-42!",
            "captcha_token": "test-turnstile-token",
        },
    )
    assert registered.status_code == 200, registered.text

    reset_missing = client.post("/auth/password-reset/request", json={"email": "captcha@example.com"})
    assert reset_missing.status_code == 422

    reset = client.post(
        "/auth/password-reset/request",
        json={"email": "captcha@example.com", "captcha_token": "test-turnstile-token"},
    )
    assert reset.status_code == 200, reset.text

    client.app.dependency_overrides.clear()


def test_signed_captcha_challenge_allows_registration_without_turnstile(client: TestClient) -> None:
    settings = Settings(captcha_required=True, captcha_provider="challenge")
    client.app.dependency_overrides[get_settings] = lambda: settings

    challenge = client.get("/auth/captcha/challenge")
    assert challenge.status_code == 200, challenge.text
    payload = challenge.json()
    assert payload["required"] is True
    assert payload["provider"] == "challenge"
    match = re.search(r"What is (\d+) \+ (\d+)", payload["prompt"])
    assert match is not None
    answer = str(int(match.group(1)) + int(match.group(2)))

    blocked = client.post(
        "/auth/register",
        json={
            "email": "signed-captcha@example.com",
            "password": "Correct-Horse-42!",
            "captcha_token": f"challenge:{payload['token']}:wrong",
        },
    )
    assert blocked.status_code == 422

    registered = client.post(
        "/auth/register",
        json={
            "email": "signed-captcha@example.com",
            "password": "Correct-Horse-42!",
            "captcha_token": f"challenge:{payload['token']}:{answer}",
        },
    )
    assert registered.status_code == 200, registered.text

    client.app.dependency_overrides.clear()


class FakeCaptchaVerifier:
    def verify(self, token: str | None, remote_ip: str | None = None) -> None:
        del remote_ip
        if not token:
            raise ValidationFailure("Complete the security check and try again.")
        if token != "test-turnstile-token":  # noqa: S105 - deterministic fake CAPTCHA token.
            raise ValidationFailure("Security check failed. Try again.")


def test_public_auth_endpoints_are_rate_limited_by_ip_and_email(client: TestClient) -> None:
    settings = Settings(auth_ip_rate_limit_per_minute=10, auth_email_rate_limit_per_hour=2)
    client.app.dependency_overrides[get_settings] = lambda: settings
    payload = {"email": "limited@example.com", "password": "Correct-Horse-42!"}

    assert client.post("/auth/register", json=payload).status_code == 200
    assert client.post("/auth/register", json=payload).status_code == 200
    blocked = client.post("/auth/register", json=payload)
    assert blocked.status_code == 429
    assert blocked.json()["message"] == "Too many requests. Try again later."

    client.app.dependency_overrides.clear()


def test_login_rate_limit_blocks_password_spraying(client: TestClient) -> None:
    settings = Settings(
        expose_auth_tokens=True,
        auto_bootstrap_site_owner=True,
        login_rate_limit_per_minute=3,
        auth_email_rate_limit_per_hour=10,
    )
    client.app.dependency_overrides[get_settings] = lambda: settings
    auth = register_verified(client, "spray@example.com")

    bad = {"email": auth["email"], "password": "Wrong-Password-42!"}
    failed = client.post("/auth/login", json=bad)
    assert failed.status_code == 401
    assert failed.json() == {"message": "Invalid email or password."}
    assert client.post("/auth/login", json=bad).status_code == 401
    blocked = client.post("/auth/login", json=bad)
    assert blocked.status_code == 429

    client.app.dependency_overrides.clear()


def test_client_identity_only_trusts_configured_proxy_headers() -> None:
    untrusted = SimpleNamespace(
        client=SimpleNamespace(host="203.0.113.10"),
        headers=Headers({"x-forwarded-for": "198.51.100.99", "x-real-ip": "198.51.100.100"}),
    )
    assert client_identity(untrusted) == "203.0.113.10"

    private_peer = SimpleNamespace(
        client=SimpleNamespace(host="172.20.0.5"),
        headers=Headers({"x-real-ip": "198.51.100.100", "x-forwarded-for": "198.51.100.99"}),
    )
    assert client_identity(private_peer) == "172.20.0.5"
    assert client_identity(private_peer, ["172.20.0.5/32"]) == "198.51.100.100"


def test_spoofed_forwarded_for_does_not_bypass_login_rate_limit(client: TestClient) -> None:
    settings = Settings(
        expose_auth_tokens=True,
        auto_bootstrap_site_owner=True,
        login_rate_limit_per_minute=3,
        auth_email_rate_limit_per_hour=10,
    )
    client.app.dependency_overrides[get_settings] = lambda: settings
    auth = register_verified(client, "spoofed@example.com")

    for spoofed_ip in ("198.51.100.1", "198.51.100.2"):
        response = client.post(
            "/auth/login",
            headers={"x-forwarded-for": spoofed_ip},
            json={"email": auth["email"], "password": "Wrong-Password-42!"},
        )
        assert response.status_code == 401

    blocked = client.post(
        "/auth/login",
        headers={"x-forwarded-for": "198.51.100.3"},
        json={"email": auth["email"], "password": "Wrong-Password-42!"},
    )
    assert blocked.status_code == 429

    client.app.dependency_overrides.clear()


def test_optional_mfa_requires_totp_or_single_use_recovery_code(client: TestClient) -> None:
    register_verified(client, "mfa-owner@example.com")
    auth = register_verified(client, "mfa@example.com")

    status = client.get("/auth/mfa/status")
    assert status.status_code == 200
    assert status.json() == {"enabled": False, "required": False}

    setup = client.post("/auth/mfa/setup", headers=csrf_headers(auth))
    assert setup.status_code == 200, setup.text
    secret = setup.json()["secret"]
    recovery_code = setup.json()["recovery_codes"][0]
    assert setup.json()["provisioning_uri"].startswith("otpauth://totp/")

    invalid = client.post("/auth/mfa/enable", headers=csrf_headers(auth), json={"code": "000000"})
    assert invalid.status_code == 401

    enabled = client.post("/auth/mfa/enable", headers=csrf_headers(auth), json={"code": current_totp(secret)})
    assert enabled.status_code == 204, enabled.text

    reset_attempt = client.post("/auth/mfa/setup", headers=csrf_headers(auth))
    assert reset_attempt.status_code == 403

    without_mfa = client.post("/auth/login", json={"email": auth["email"], "password": auth["password"]})
    assert without_mfa.status_code == 401
    assert without_mfa.json()["code"] == "mfa_required"

    with_totp = client.post(
        "/auth/login",
        json={"email": auth["email"], "password": auth["password"], "mfa_code": current_totp(secret)},
    )
    assert with_totp.status_code == 200, with_totp.text

    with_recovery = client.post(
        "/auth/login",
        json={"email": auth["email"], "password": auth["password"], "mfa_code": recovery_code},
    )
    assert with_recovery.status_code == 200, with_recovery.text
    latest_auth = {**auth, "csrf": with_recovery.json()["csrf_token"]}

    reused_recovery = client.post(
        "/auth/login",
        json={"email": auth["email"], "password": auth["password"], "mfa_code": recovery_code},
    )
    assert reused_recovery.status_code == 401
    assert reused_recovery.json()["code"] == "mfa_required"

    disabled = client.post("/auth/mfa/disable", headers=csrf_headers(latest_auth), json={"code": current_totp(secret)})
    assert disabled.status_code == 204, disabled.text

    after_disable = client.post("/auth/login", json={"email": auth["email"], "password": auth["password"]})
    assert after_disable.status_code == 200, after_disable.text


def test_mfa_disable_attempts_are_rate_limited(client: TestClient) -> None:
    settings = Settings(
        expose_auth_tokens=True,
        auto_bootstrap_site_owner=True,
        mfa_change_rate_limit_per_minute=2,
    )
    client.app.dependency_overrides[get_settings] = lambda: settings
    register_verified(client, "mfa-limit-owner@example.com")
    auth = register_verified(client, "mfa-limit@example.com")
    setup = client.post("/auth/mfa/setup", headers=csrf_headers(auth))
    assert setup.status_code == 200, setup.text
    enabled = client.post(
        "/auth/mfa/enable",
        headers=csrf_headers(auth),
        json={"code": current_totp(setup.json()["secret"])},
    )
    assert enabled.status_code == 204, enabled.text

    first = client.post("/auth/mfa/disable", headers=csrf_headers(auth), json={"code": "000000"})
    assert first.status_code == 401
    blocked = client.post("/auth/mfa/disable", headers=csrf_headers(auth), json={"code": "111111"})
    assert blocked.status_code == 429
    assert blocked.json()["message"] == "Too many requests. Try again later."

    client.app.dependency_overrides.clear()


def test_large_user_controlled_text_fields_are_rejected(client: TestClient) -> None:
    auth = register_verified(client, "limits@example.com")
    project = client.post(
        "/projects",
        headers=csrf_headers(auth),
        json={"workspace_id": auth["workspace_id"], "title": "Limits", "description": ""},
    )
    assert project.status_code == 200, project.text

    oversized_review = client.post(
        f"/projects/{project.json()['id']}/reviews",
        headers=csrf_headers(auth),
        json={"title": "Too large", "proposal_text": "x" * 50001, "mode": "basic", "focus_chips": []},
    )
    assert oversized_review.status_code == 422
    assert oversized_review.json()["message"] == "Check the form fields and try again."

    review = client.post(
        f"/projects/{project.json()['id']}/reviews",
        headers=csrf_headers(auth),
        json={"title": "Allowed", "proposal_text": "short", "mode": "basic", "focus_chips": []},
    )
    assert review.status_code == 200, review.text

    oversized_text = client.post(
        f"/reviews/{review.json()['id']}/sources/text",
        headers=csrf_headers(auth),
        json={"text": "x" * 50001},
    )
    assert oversized_text.status_code == 422
