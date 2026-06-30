from __future__ import annotations

from pathlib import Path

import pytest

from app.core.config import Settings, validate_production_settings
from app.infrastructure.storage.object_storage import LocalObjectStorage
from app.interfaces.api import dependencies


def test_production_csp_allows_configured_turnstile_origin() -> None:
    root = Path(__file__).resolve().parents[3]
    caddyfile = root / "deploy" / "cheap-vps" / "Caddyfile"
    text = caddyfile.read_text(encoding="utf-8")

    assert "https://challenges.cloudflare.com" in text
    assert "connect-src 'self' https://challenges.cloudflare.com" in text
    assert "script-src 'self' https://challenges.cloudflare.com" in text
    assert "frame-src https://challenges.cloudflare.com" in text


def test_production_permissions_policy_allows_voice_notes_only() -> None:
    root = Path(__file__).resolve().parents[3]
    caddyfile = root / "deploy" / "cheap-vps" / "Caddyfile"
    text = caddyfile.read_text(encoding="utf-8")

    assert 'Permissions-Policy "camera=(), microphone=(self), geolocation=()"' in text
    assert "microphone=()" not in text


def test_production_settings_fail_closed_for_unsafe_defaults() -> None:
    settings = Settings(
        app_env="production",
        app_secret_key="change-me-for-local-development-only",  # noqa: S106 - verifies unsafe default rejection.
        cookie_secure=False,
        public_app_url="http://redteamagent.co.uk",
        cors_origins="http://localhost:5173",
        database_url="sqlite+pysqlite:///:memory:",
        allow_fake_provider=True,
        expose_auth_tokens=True,
        auto_bootstrap_site_owner=True,
        captcha_required=False,
        mail_delivery="local",
    )

    with pytest.raises(RuntimeError) as exc:
        validate_production_settings(settings)

    message = str(exc.value)
    assert "APP_SECRET_KEY must be a production secret" in message
    assert "COOKIE_SECURE must be true" in message
    assert "CAPTCHA_REQUIRED must be true" in message
    assert "EXPOSE_AUTH_TOKENS must be false" in message
    assert "AUTO_BOOTSTRAP_SITE_OWNER must be false" in message
    assert "CAPTCHA_PROVIDER must be turnstile" in message
    assert "SITE_OWNER_BOOTSTRAP_TOKEN must be configured" in message


def test_production_settings_accept_hardened_configuration() -> None:
    settings = Settings(
        app_env="production",
        app_secret_key="prod-secret-that-is-long-enough-for-signing",  # noqa: S106 - deterministic test value.
        cookie_secure=True,
        public_app_url="https://redteamagent.co.uk",
        cors_origins="https://redteamagent.co.uk,https://www.redteamagent.co.uk",
        database_url="postgresql+psycopg://redteam:secret@postgres:5432/redteam",
        allow_fake_provider=False,
        captcha_required=True,
        captcha_provider="turnstile",
        turnstile_secret_key="turnstile-secret",  # noqa: S106 - deterministic test value.
        site_owner_bootstrap_token="site-owner-bootstrap-token-for-tests",  # noqa: S106
        mail_delivery="smtp",
        smtp_host="smtp.resend.com",
        smtp_username="resend",
        smtp_password="re_example_secret",  # noqa: S106 - deterministic test value.
    )

    validate_production_settings(settings)


def test_production_settings_reject_challenge_captcha_and_plain_smtp() -> None:
    settings = Settings(
        app_env="production",
        app_secret_key="prod-secret-that-is-long-enough-for-signing",  # noqa: S106
        cookie_secure=True,
        public_app_url="https://redteamagent.co.uk",
        cors_origins="https://redteamagent.co.uk",
        database_url="postgresql+psycopg://redteam:secret@postgres:5432/redteam",
        allow_fake_provider=False,
        captcha_required=True,
        captcha_provider="challenge",
        turnstile_secret_key="",
        site_owner_bootstrap_token="site-owner-bootstrap-token-for-tests",  # noqa: S106
        mail_delivery="smtp",
        smtp_host="smtp.resend.com",
        smtp_username="resend",
        smtp_password="re_example_secret",  # noqa: S106
        smtp_starttls=False,
    )

    with pytest.raises(RuntimeError) as exc:
        validate_production_settings(settings)

    message = str(exc.value)
    assert "CAPTCHA_PROVIDER must be turnstile" in message
    assert "SMTP_STARTTLS must be true" in message


def test_object_storage_dependency_uses_local_fallback_without_s3_secret() -> None:
    settings = Settings(s3_secret_access_key="")

    storage = dependencies.object_storage(settings)

    assert isinstance(storage, LocalObjectStorage)


def test_object_storage_dependency_uses_s3_when_credentials_exist(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeS3ObjectStorage:
        def __init__(self, settings: Settings) -> None:
            self.settings = settings

    monkeypatch.setattr(dependencies, "S3ObjectStorage", FakeS3ObjectStorage)
    settings = Settings(
        s3_endpoint_url="http://minio:9000",
        s3_access_key_id="minio",
        s3_secret_access_key="secret",  # noqa: S106 - deterministic test value.
    )

    storage = dependencies.object_storage(settings)

    assert isinstance(storage, FakeS3ObjectStorage)
    assert storage.settings is settings
