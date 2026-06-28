from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request, Response

from app.application.auth_service import AuthService
from app.application.mfa_service import MfaService
from app.application.passkey_service import PRIVILEGED_ACCOUNT_TYPES, PasskeyService
from app.core.config import Settings, get_settings
from app.domain.exceptions import AuthenticationError, AuthorisationError
from app.infrastructure.auth.security import new_csrf_token
from app.infrastructure.security.captcha import CaptchaVerifier
from app.infrastructure.security.rate_limit import AbuseLimiter, LimitRule
from app.interfaces.api.dependencies import (
    AuthContext,
    abuse_limiter,
    auth_service,
    captcha_verifier,
    check_auth_rate_limit,
    client_identity,
    current_context,
    mfa_service,
    passkey_service,
    require_csrf,
)
from app.interfaces.api.schemas import (
    AuthResponse,
    CaptchaChallengeView,
    LoginRequest,
    MfaCodeRequest,
    MfaRequirementView,
    MfaSetupView,
    MfaStatusView,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    RegisterRequest,
    UserView,
    VerifyEmailRequest,
    WorkspaceView,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/captcha/challenge", response_model=CaptchaChallengeView)
def captcha_challenge(
    request: Request,
    limiter: Annotated[AbuseLimiter, Depends(abuse_limiter)],
    captcha: Annotated[CaptchaVerifier, Depends(captcha_verifier)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CaptchaChallengeView:
    check_auth_rate_limit(request, limiter, settings, "captcha")
    identity = client_identity(request, settings.trusted_proxy_network_list)
    return CaptchaChallengeView.model_validate(captcha.issue_challenge(identity), from_attributes=True)


@router.post("/register", response_model=AuthResponse)
def register(
    payload: RegisterRequest,
    request: Request,
    service: Annotated[AuthService, Depends(auth_service)],
    limiter: Annotated[AbuseLimiter, Depends(abuse_limiter)],
    captcha: Annotated[CaptchaVerifier, Depends(captcha_verifier)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthResponse:
    check_auth_rate_limit(request, limiter, settings, "register", str(payload.email))
    captcha.verify(payload.captcha_token, client_identity(request, settings.trusted_proxy_network_list))
    result = service.register(str(payload.email), payload.password, payload.site_owner_bootstrap_token)
    return AuthResponse(
        user=UserView(id="00000000-0000-0000-0000-000000000000", email=payload.email, is_verified=False),
        workspace=WorkspaceView(id="00000000-0000-0000-0000-000000000000", name="not returned"),
        workspace_role=None,
        verification_token=result["verification_token"],
    )


@router.post("/verify-email", status_code=204)
def verify_email(
    payload: VerifyEmailRequest,
    request: Request,
    service: Annotated[AuthService, Depends(auth_service)],
    limiter: Annotated[AbuseLimiter, Depends(abuse_limiter)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    check_auth_rate_limit(request, limiter, settings, "verify_email")
    service.verify_email(payload.token)


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    service: Annotated[AuthService, Depends(auth_service)],
    passkeys: Annotated[PasskeyService, Depends(passkey_service)],
    limiter: Annotated[AbuseLimiter, Depends(abuse_limiter)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthResponse:
    check_auth_rate_limit(request, limiter, settings, "login", str(payload.email))
    csrf_token = new_csrf_token()
    result = service.login(
        str(payload.email),
        payload.password,
        csrf_token,
        payload.mfa_code,
        client_identity(request, settings.trusted_proxy_network_list),
    )
    response.set_cookie(
        "rta_session",
        result["session"].id,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
    )
    response.set_cookie("rta_csrf", csrf_token, httponly=False, samesite="lax", secure=settings.cookie_secure)
    return _auth_response(result, csrf_token, passkeys)


@router.post("/logout", status_code=204, dependencies=[Depends(require_csrf)])
def logout(
    response: Response,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[AuthService, Depends(auth_service)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    service.logout(context.session.id, context.user.id)
    response.delete_cookie("rta_session", secure=settings.cookie_secure, samesite="lax")
    response.delete_cookie("rta_csrf", secure=settings.cookie_secure, samesite="lax")


@router.post("/password-reset/request", response_model=AuthResponse)
def request_password_reset(
    payload: PasswordResetRequest,
    request: Request,
    service: Annotated[AuthService, Depends(auth_service)],
    limiter: Annotated[AbuseLimiter, Depends(abuse_limiter)],
    captcha: Annotated[CaptchaVerifier, Depends(captcha_verifier)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthResponse:
    check_auth_rate_limit(request, limiter, settings, "password_reset", str(payload.email))
    captcha.verify(payload.captcha_token, client_identity(request, settings.trusted_proxy_network_list))
    result = service.request_password_reset(str(payload.email))
    return AuthResponse(
        user=UserView(id="00000000-0000-0000-0000-000000000000", email=payload.email, is_verified=False),
        workspace=WorkspaceView(id="00000000-0000-0000-0000-000000000000", name="not returned"),
        reset_token=result["reset_token"],
    )


@router.post("/password-reset/confirm", status_code=204)
def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    request: Request,
    service: Annotated[AuthService, Depends(auth_service)],
    limiter: Annotated[AbuseLimiter, Depends(abuse_limiter)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    check_auth_rate_limit(request, limiter, settings, "password_reset_confirm")
    service.confirm_password_reset(payload.token, payload.password)


@router.get("/me", response_model=AuthResponse)
def me(
    context: Annotated[AuthContext, Depends(current_context)],
    passkeys: Annotated[PasskeyService, Depends(passkey_service)],
) -> AuthResponse:
    workspace = context.user and context.session
    del workspace
    requirements = passkeys.requirements(context.user.id, context.session.id, context.user.account_type)
    return AuthResponse(
        user=UserView.model_validate(context.user),
        workspace=WorkspaceView(id="active", name="Active workspace"),
        csrf_token=context.session.csrf_token,
        mfa_requirements=MfaRequirementView.model_validate(requirements),
        mfa_setup_required=requirements["setup_required"],
        passkey_verification_required=requirements["passkey_verification_required"],
    )


@router.get("/mfa/status", response_model=MfaStatusView)
def mfa_status(
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[MfaService, Depends(mfa_service)],
) -> MfaStatusView:
    status = service.status(context.user.id)
    status["required"] = context.user.account_type in PRIVILEGED_ACCOUNT_TYPES
    return MfaStatusView.model_validate(status)


@router.post("/mfa/setup", response_model=MfaSetupView, dependencies=[Depends(require_csrf)])
def mfa_setup(
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[MfaService, Depends(mfa_service)],
) -> MfaSetupView:
    return MfaSetupView.model_validate(service.setup(context.user.id, context.user.email))


@router.post("/mfa/enable", status_code=204, dependencies=[Depends(require_csrf)])
def mfa_enable(
    payload: MfaCodeRequest,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[MfaService, Depends(mfa_service)],
    limiter: Annotated[AbuseLimiter, Depends(abuse_limiter)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    _check_mfa_change_rate_limit(limiter, settings, context.user.id)
    try:
        service.enable(context.user.id, payload.code)
    except ValueError as exc:
        raise AuthenticationError("Invalid multi-factor code.") from exc


@router.post("/mfa/disable", status_code=204, dependencies=[Depends(require_csrf)])
def mfa_disable(
    payload: MfaCodeRequest,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[MfaService, Depends(mfa_service)],
    limiter: Annotated[AbuseLimiter, Depends(abuse_limiter)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    if settings.privileged_mfa_required and context.user.account_type in PRIVILEGED_ACCOUNT_TYPES:
        raise AuthorisationError("Owner and admin accounts must keep authenticator-app MFA enabled.")
    _check_mfa_change_rate_limit(limiter, settings, context.user.id)
    try:
        service.disable(context.user.id, payload.code)
    except ValueError as exc:
        raise AuthenticationError("Invalid multi-factor code.") from exc


def _check_mfa_change_rate_limit(limiter: AbuseLimiter, settings: Settings, user_id: str) -> None:
    limiter.check(LimitRule("mfa_change:user", settings.mfa_change_rate_limit_per_minute, 60), user_id)


def _auth_response(result: dict[str, Any], csrf_token: str, passkeys: PasskeyService) -> AuthResponse:
    user = result["user"]
    session = result["session"]
    requirements = passkeys.requirements(user.id, session.id, user.account_type)
    return AuthResponse(
        user=UserView.model_validate(user),
        workspace=WorkspaceView.model_validate(result["workspace"]),
        workspace_role=result["workspace_role"],
        csrf_token=csrf_token,
        mfa_requirements=MfaRequirementView.model_validate(requirements),
        mfa_setup_required=requirements["setup_required"],
        passkey_verification_required=requirements["passkey_verification_required"],
    )
