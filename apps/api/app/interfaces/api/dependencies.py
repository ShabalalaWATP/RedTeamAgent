from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Annotated, Any

from fastapi import Cookie, Depends, Header, Request
from sqlalchemy.orm import Session

from app.application.auth_service import AuthService
from app.application.ports.notifications import EmailSender
from app.application.project_service import ProjectService
from app.application.provider_service import ProviderService
from app.application.review_service import ReviewService
from app.application.workflow_service import WorkflowService
from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.domain.exceptions import AuthenticationError, RateLimitExceeded
from app.infrastructure.auth.security import PasswordService, TokenService
from app.infrastructure.db.repositories import SqlRepository
from app.infrastructure.ingestion.extractors import SourceExtractor
from app.infrastructure.notifications.email import NullEmailSender, SmtpEmailSender
from app.infrastructure.providers.adapters import ProviderRegistry
from app.infrastructure.storage.object_storage import LocalObjectStorage


@dataclass(frozen=True)
class AuthContext:
    user: Any
    session: Any


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self.hits: dict[str, list[float]] = {}

    def check(self, key: str) -> None:
        now = time.monotonic()
        current = [hit for hit in self.hits.get(key, []) if now - hit < self.window_seconds]
        if len(current) >= self.limit:
            raise RateLimitExceeded("Too many requests. Try again later.")
        current.append(now)
        self.hits[key] = current


login_limiter = RateLimiter(limit=10, window_seconds=60)
expensive_limiter = RateLimiter(limit=20, window_seconds=60)


def get_repo(db: Annotated[Session, Depends(get_db)]) -> SqlRepository:
    return SqlRepository(db)


def password_service() -> PasswordService:
    return PasswordService()


def token_service(settings: Annotated[Settings, Depends(get_settings)]) -> TokenService:
    return TokenService(settings.app_secret_key)


def email_sender(settings: Annotated[Settings, Depends(get_settings)]) -> EmailSender:
    if settings.mail_delivery == "smtp":
        return SmtpEmailSender(settings)
    return NullEmailSender()


def auth_service(
    repo: Annotated[SqlRepository, Depends(get_repo)],
    passwords: Annotated[PasswordService, Depends(password_service)],
    tokens: Annotated[TokenService, Depends(token_service)],
    sender: Annotated[EmailSender, Depends(email_sender)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthService:
    return AuthService(repo, passwords, tokens, sender, settings.public_app_url, settings.is_local)


def project_service(repo: Annotated[SqlRepository, Depends(get_repo)]) -> ProjectService:
    return ProjectService(repo)


def provider_registry(settings: Annotated[Settings, Depends(get_settings)]) -> ProviderRegistry:
    return ProviderRegistry(settings.self_hosted_provider_mode)


def provider_service(
    repo: Annotated[SqlRepository, Depends(get_repo)],
    registry: Annotated[ProviderRegistry, Depends(provider_registry)],
) -> ProviderService:
    return ProviderService(repo, registry)


def review_service(
    repo: Annotated[SqlRepository, Depends(get_repo)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ReviewService:
    storage = LocalObjectStorage(Path(".local-object-storage"))
    return ReviewService(repo, storage, SourceExtractor(), settings.max_upload_bytes)


def workflow_service(
    repo: Annotated[SqlRepository, Depends(get_repo)],
    registry: Annotated[ProviderRegistry, Depends(provider_registry)],
) -> WorkflowService:
    return WorkflowService(repo, registry)


def current_context(
    repo: Annotated[SqlRepository, Depends(get_repo)],
    session_id: Annotated[str | None, Cookie(alias="rta_session")] = None,
) -> AuthContext:
    if session_id is None:
        raise AuthenticationError("Authentication required.")
    session = repo.get_session(session_id)
    if session is None:
        raise AuthenticationError("Session expired or invalid.")
    user = repo.get_user(session.user_id)
    if user is None:
        raise AuthenticationError("Session user not found.")
    return AuthContext(user=user, session=session)


def require_csrf(
    context: Annotated[AuthContext, Depends(current_context)],
    csrf_header: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
) -> None:
    if not csrf_header or csrf_header != context.session.csrf_token:
        raise AuthenticationError("CSRF token is missing or invalid.")


def rate_limit_login(request: Request) -> None:
    login_limiter.check(f"login:{request.client.host if request.client else 'unknown'}")


def rate_limit_expensive(context: Annotated[AuthContext, Depends(current_context)]) -> None:
    expensive_limiter.check(f"expensive:{context.user.id}")
