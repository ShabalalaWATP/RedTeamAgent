from __future__ import annotations

from functools import lru_cache
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

LOCAL_APP_SECRET = "change-me-for-local-development-only"  # noqa: S105  # nosec


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "local"
    app_secret_key: str = Field(default=LOCAL_APP_SECRET, min_length=16)
    database_url: str = "sqlite+pysqlite:///:memory:"
    redis_url: str = "redis://localhost:6379/0"
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key_id: str = "minioadmin"
    s3_secret_access_key: str = ""
    s3_bucket: str = "redteam-agent"
    cookie_secure: bool = False
    allow_fake_provider: bool = True
    self_hosted_provider_mode: bool = False
    cors_origins: str = "http://localhost:5173"
    max_upload_bytes: int = 10 * 1024 * 1024
    user_project_limit: int = Field(default=5, ge=0)
    user_workflow_total_limit: int = Field(default=20, ge=0)
    user_workflow_weekly_limit: int = Field(default=10, ge=0)
    admin_usage_multiplier: int = Field(default=3, ge=1)
    public_app_url: str = "http://localhost:5173"
    captcha_required: bool = False
    captcha_provider: Literal["auto", "turnstile", "challenge"] = "auto"
    captcha_challenge_ttl_seconds: int = Field(default=300, ge=60, le=900)
    turnstile_secret_key: str = ""
    privileged_mfa_required: bool = True
    mfa_issuer: str = "RedTeamAgent"
    mfa_change_rate_limit_per_minute: int = Field(default=5, ge=1)
    webauthn_rp_id: str = ""
    webauthn_rp_name: str = "RedTeamAgent"
    expose_auth_tokens: bool = False
    auto_bootstrap_site_owner: bool = False
    site_owner_bootstrap_token: str = ""
    login_rate_limit_per_minute: int = Field(default=10, ge=1)
    auth_email_rate_limit_per_hour: int = Field(default=6, ge=1)
    auth_ip_rate_limit_per_minute: int = Field(default=30, ge=1)
    expensive_rate_limit_per_minute: int = Field(default=20, ge=1)
    site_visit_rate_limit_per_minute: int = Field(default=120, ge=1)
    trusted_proxy_networks: str = "127.0.0.0/8,::1/128"
    mail_delivery: str = "local"
    mail_from: str = "RedTeamAgent <noreply@localhost>"
    smtp_host: str = "localhost"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = True
    hosted_provider_base_urls: tuple[str, ...] = (
        "https://api.openai.com",
        "https://api.anthropic.com",
        "https://generativelanguage.googleapis.com",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_local(self) -> bool:
        return self.app_env in {"local", "test"}

    @property
    def trusted_proxy_network_list(self) -> list[str]:
        return [network.strip() for network in self.trusted_proxy_networks.split(",") if network.strip()]


def validate_production_settings(settings: Settings) -> None:
    if settings.is_local:
        return
    failures: list[str] = []
    if settings.app_secret_key == LOCAL_APP_SECRET or settings.app_secret_key.startswith("replace-"):
        failures.append("APP_SECRET_KEY must be a production secret.")
    if len(settings.app_secret_key) < 32:
        failures.append("APP_SECRET_KEY must be at least 32 characters in production.")
    if not settings.cookie_secure:
        failures.append("COOKIE_SECURE must be true in production.")
    if not settings.public_app_url.startswith("https://"):
        failures.append("PUBLIC_APP_URL must use HTTPS in production.")
    if _has_unsafe_origins(settings.cors_origin_list):
        failures.append("CORS_ORIGINS must contain only explicit HTTPS origins in production.")
    if settings.database_url.startswith("sqlite"):
        failures.append("DATABASE_URL must not use SQLite in production.")
    if settings.allow_fake_provider:
        failures.append("ALLOW_FAKE_PROVIDER must be false in production.")
    if settings.expose_auth_tokens:
        failures.append("EXPOSE_AUTH_TOKENS must be false in production.")
    if settings.auto_bootstrap_site_owner:
        failures.append("AUTO_BOOTSTRAP_SITE_OWNER must be false in production.")
    if not settings.captcha_required:
        failures.append("CAPTCHA_REQUIRED must be true in production.")
    if settings.captcha_provider != "turnstile" or _is_placeholder(settings.turnstile_secret_key):
        failures.append("CAPTCHA_PROVIDER must be turnstile with TURNSTILE_SECRET_KEY in production.")
    if _is_placeholder(settings.site_owner_bootstrap_token) or len(settings.site_owner_bootstrap_token) < 32:
        failures.append("SITE_OWNER_BOOTSTRAP_TOKEN must be configured in production.")
    if not settings.privileged_mfa_required:
        failures.append("PRIVILEGED_MFA_REQUIRED must be true in production.")
    if settings.mail_delivery != "smtp":
        failures.append("MAIL_DELIVERY must be smtp in production.")
    if not settings.smtp_starttls:
        failures.append("SMTP_STARTTLS must be true in production.")
    if (
        _is_placeholder(settings.smtp_host)
        or _is_placeholder(settings.smtp_username)
        or _is_placeholder(settings.smtp_password)
    ):
        failures.append("SMTP_HOST, SMTP_USERNAME and SMTP_PASSWORD must be configured in production.")
    if failures:
        raise RuntimeError("Unsafe production configuration: " + " ".join(failures))


def _has_unsafe_origins(origins: list[str]) -> bool:
    if not origins:
        return True
    for origin in origins:
        parsed = urlparse(origin)
        hostname = parsed.hostname or ""
        if parsed.scheme != "https" or "*" in origin or hostname in {"localhost", "127.0.0.1", "::1"}:
            return True
    return False


def _is_placeholder(value: str) -> bool:
    clean = value.strip().lower()
    return not clean or clean.startswith("replace") or clean in {"smtp.example.com", "localhost"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
