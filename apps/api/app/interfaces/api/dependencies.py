from __future__ import annotations

from dataclasses import dataclass
from ipaddress import ip_address, ip_network
from pathlib import Path
from typing import Annotated, Any

from fastapi import Cookie, Depends, Header, Request
from sqlalchemy.orm import Session

from app.application.auth_service import AuthService
from app.application.enterprise_operations_service import EnterpriseOperationsService
from app.application.enterprise_service import EnterpriseService
from app.application.evaluation_service import EvaluationService
from app.application.mfa_service import MfaService
from app.application.ports.notifications import EmailSender
from app.application.project_service import ProjectService
from app.application.provider_governance import ProviderGovernanceService
from app.application.provider_service import ProviderService
from app.application.review_service import ReviewService
from app.application.usage_policy import UsagePolicy
from app.application.workflow_service import WorkflowService
from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.domain.exceptions import AuthenticationError
from app.infrastructure.auth.credentials import FernetCredentialVault
from app.infrastructure.auth.security import PasswordService, TokenService
from app.infrastructure.db.enterprise_repository import SqlEnterpriseRepository
from app.infrastructure.db.repositories import SqlRepository
from app.infrastructure.ingestion.extractors import SourceExtractor
from app.infrastructure.notifications.email import NullEmailSender, SmtpEmailSender
from app.infrastructure.providers.adapters import ProviderRegistry
from app.infrastructure.security.captcha import CaptchaVerifier
from app.infrastructure.security.rate_limit import AbuseLimiter, LimitRule, MemoryRateLimitStore, RedisRateLimitStore
from app.infrastructure.storage.object_storage import LocalObjectStorage


@dataclass(frozen=True)
class AuthContext:
    user: Any
    session: Any


local_rate_limit_store = MemoryRateLimitStore()
_redis_rate_limit_stores: dict[str, RedisRateLimitStore] = {}
TRUSTED_PROXY_NETWORKS = (
    ip_network("127.0.0.0/8"),
    ip_network("10.0.0.0/8"),
    ip_network("172.16.0.0/12"),
    ip_network("192.168.0.0/16"),
    ip_network("::1/128"),
    ip_network("fc00::/7"),
    ip_network("fe80::/10"),
)


def get_repo(db: Annotated[Session, Depends(get_db)]) -> SqlRepository:
    return SqlRepository(db)


def get_enterprise_repo(db: Annotated[Session, Depends(get_db)]) -> SqlEnterpriseRepository:
    return SqlEnterpriseRepository(db)


def password_service() -> PasswordService:
    return PasswordService()


def token_service(settings: Annotated[Settings, Depends(get_settings)]) -> TokenService:
    return TokenService(settings.app_secret_key)


def credential_vault(settings: Annotated[Settings, Depends(get_settings)]) -> FernetCredentialVault:
    return FernetCredentialVault(settings.app_secret_key)


def abuse_limiter(settings: Annotated[Settings, Depends(get_settings)]) -> AbuseLimiter:
    if settings.is_local:
        return AbuseLimiter(local_rate_limit_store)
    store = _redis_rate_limit_stores.setdefault(settings.redis_url, RedisRateLimitStore(settings.redis_url))
    return AbuseLimiter(store)


def captcha_verifier(settings: Annotated[Settings, Depends(get_settings)]) -> CaptchaVerifier:
    return CaptchaVerifier(settings)


def email_sender(settings: Annotated[Settings, Depends(get_settings)]) -> EmailSender:
    if settings.mail_delivery == "smtp":
        return SmtpEmailSender(settings)
    return NullEmailSender()


def usage_policy(settings: Annotated[Settings, Depends(get_settings)]) -> UsagePolicy:
    return UsagePolicy(
        user_project_limit=settings.user_project_limit,
        user_workflow_total_limit=settings.user_workflow_total_limit,
        user_workflow_weekly_limit=settings.user_workflow_weekly_limit,
        admin_usage_multiplier=settings.admin_usage_multiplier,
    )


def mfa_service(
    repo: Annotated[SqlRepository, Depends(get_repo)],
    passwords: Annotated[PasswordService, Depends(password_service)],
    vault: Annotated[FernetCredentialVault, Depends(credential_vault)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> MfaService:
    return MfaService(repo, passwords, vault, settings.mfa_issuer)


def auth_service(
    repo: Annotated[SqlRepository, Depends(get_repo)],
    passwords: Annotated[PasswordService, Depends(password_service)],
    tokens: Annotated[TokenService, Depends(token_service)],
    sender: Annotated[EmailSender, Depends(email_sender)],
    settings: Annotated[Settings, Depends(get_settings)],
    mfa: Annotated[MfaService, Depends(mfa_service)],
) -> AuthService:
    return AuthService(repo, passwords, tokens, sender, settings.public_app_url, settings.is_local, mfa)


def project_service(
    repo: Annotated[SqlRepository, Depends(get_repo)],
    policy: Annotated[UsagePolicy, Depends(usage_policy)],
) -> ProjectService:
    return ProjectService(repo, policy)


def evaluation_service(repo: Annotated[SqlRepository, Depends(get_repo)]) -> EvaluationService:
    return EvaluationService(repo)


def provider_registry(settings: Annotated[Settings, Depends(get_settings)]) -> ProviderRegistry:
    return ProviderRegistry(settings.self_hosted_provider_mode, settings.allow_fake_provider)


def provider_governance(
    repo: Annotated[SqlEnterpriseRepository, Depends(get_enterprise_repo)],
) -> ProviderGovernanceService:
    return ProviderGovernanceService(repo)


def provider_service(
    repo: Annotated[SqlRepository, Depends(get_repo)],
    governance: Annotated[ProviderGovernanceService, Depends(provider_governance)],
    registry: Annotated[ProviderRegistry, Depends(provider_registry)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ProviderService:
    return ProviderService(repo, registry, FernetCredentialVault(settings.app_secret_key), governance)


def review_service(
    repo: Annotated[SqlRepository, Depends(get_repo)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ReviewService:
    storage = LocalObjectStorage(Path(".local-object-storage"))
    return ReviewService(repo, storage, SourceExtractor(), settings.max_upload_bytes)


def workflow_service(
    repo: Annotated[SqlRepository, Depends(get_repo)],
    governance: Annotated[ProviderGovernanceService, Depends(provider_governance)],
    registry: Annotated[ProviderRegistry, Depends(provider_registry)],
    policy: Annotated[UsagePolicy, Depends(usage_policy)],
) -> WorkflowService:
    return WorkflowService(repo, registry, governance, policy)


def enterprise_service(
    repo: Annotated[SqlEnterpriseRepository, Depends(get_enterprise_repo)],
) -> EnterpriseService:
    return EnterpriseService(repo)


def enterprise_operations_service(
    repo: Annotated[SqlEnterpriseRepository, Depends(get_enterprise_repo)],
) -> EnterpriseOperationsService:
    return EnterpriseOperationsService(repo)


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
    if getattr(user, "account_status", "active") != "active":
        raise AuthenticationError(str(getattr(user, "status_message", "") or "This account is not active."))
    return AuthContext(user=user, session=session)


def require_csrf(
    context: Annotated[AuthContext, Depends(current_context)],
    csrf_header: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
) -> None:
    if not csrf_header or csrf_header != context.session.csrf_token:
        raise AuthenticationError("CSRF token is missing or invalid.")


def _is_trusted_proxy(peer_host: str | None) -> bool:
    if not peer_host:
        return False
    try:
        peer_ip = ip_address(peer_host)
    except ValueError:
        return False
    return any(peer_ip in network for network in TRUSTED_PROXY_NETWORKS)


def _header_ip(value: str | None) -> str | None:
    if not value:
        return None
    candidate = value.split(",", 1)[0].strip()
    if not candidate:
        return None
    try:
        ip_address(candidate)
    except ValueError:
        return None
    return candidate


def client_identity(request: Request) -> str:
    peer = request.client.host if request.client else None
    if _is_trusted_proxy(peer):
        real_ip = _header_ip(request.headers.get("x-real-ip")) or _header_ip(request.headers.get("x-forwarded-for"))
        if real_ip:
            return real_ip
    return peer or "unknown"


def check_auth_rate_limit(
    request: Request,
    limiter: AbuseLimiter,
    settings: Settings,
    action: str,
    email: str | None = None,
) -> None:
    ip = client_identity(request)
    ip_limit = settings.login_rate_limit_per_minute if action == "login" else settings.auth_ip_rate_limit_per_minute
    limiter.check(LimitRule(f"auth:{action}:ip", ip_limit, 60), ip)
    if email:
        limiter.check(LimitRule(f"auth:{action}:email", settings.auth_email_rate_limit_per_hour, 3600), email.lower())


def rate_limit_expensive(
    context: Annotated[AuthContext, Depends(current_context)],
    limiter: Annotated[AbuseLimiter, Depends(abuse_limiter)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    limiter.check(LimitRule("expensive:user", settings.expensive_rate_limit_per_minute, 60), context.user.id)
