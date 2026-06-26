from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "local"
    app_secret_key: str = Field(default="change-me-for-local-development-only", min_length=16)
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
    daily_review_run_limit: int = Field(default=20, ge=0)
    public_app_url: str = "http://localhost:5173"
    captcha_required: bool = False
    captcha_provider: Literal["auto", "turnstile", "challenge"] = "auto"
    captcha_challenge_ttl_seconds: int = Field(default=300, ge=60, le=900)
    turnstile_secret_key: str = ""
    mfa_issuer: str = "RedTeamAgent"
    login_rate_limit_per_minute: int = Field(default=10, ge=1)
    auth_email_rate_limit_per_hour: int = Field(default=6, ge=1)
    auth_ip_rate_limit_per_minute: int = Field(default=30, ge=1)
    expensive_rate_limit_per_minute: int = Field(default=20, ge=1)
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


@lru_cache
def get_settings() -> Settings:
    return Settings()
