from __future__ import annotations

from pathlib import Path

import pytest

from app.core.config import Settings, validate_production_settings


def test_production_csp_allows_configured_turnstile_origin() -> None:
    root = Path(__file__).resolve().parents[3]
    caddyfile = root / "deploy" / "cheap-vps" / "Caddyfile"
    text = caddyfile.read_text(encoding="utf-8")

    assert "https://challenges.cloudflare.com" in text
    assert "connect-src 'self' https://challenges.cloudflare.com" in text
    assert "script-src 'self' https://challenges.cloudflare.com" in text
    assert "frame-src https://challenges.cloudflare.com" in text


def test_production_settings_fail_closed_for_unsafe_defaults() -> None:
    settings = Settings(
        app_env="production",
        app_secret_key="change-me-for-local-development-only",  # noqa: S106 - verifies unsafe default rejection.
        cookie_secure=False,
        public_app_url="http://redteamagent.co.uk",
        cors_origins="http://localhost:5173",
        database_url="sqlite+pysqlite:///:memory:",
        allow_fake_provider=True,
        captcha_required=False,
        mail_delivery="local",
    )

    with pytest.raises(RuntimeError) as exc:
        validate_production_settings(settings)

    message = str(exc.value)
    assert "APP_SECRET_KEY must be a production secret" in message
    assert "COOKIE_SECURE must be true" in message
    assert "CAPTCHA_REQUIRED must be true" in message


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
        mail_delivery="smtp",
        smtp_host="smtp.resend.com",
        smtp_username="resend",
        smtp_password="re_example_secret",  # noqa: S106 - deterministic test value.
    )

    validate_production_settings(settings)
