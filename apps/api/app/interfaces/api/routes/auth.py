from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.application.auth_service import AuthService
from app.core.config import Settings, get_settings
from app.infrastructure.auth.security import new_csrf_token
from app.interfaces.api.dependencies import AuthContext, auth_service, current_context, rate_limit_login, require_csrf
from app.interfaces.api.schemas import (
    AuthResponse,
    LoginRequest,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    RegisterRequest,
    UserView,
    VerifyEmailRequest,
    WorkspaceView,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
def register(payload: RegisterRequest, service: Annotated[AuthService, Depends(auth_service)]) -> AuthResponse:
    result = service.register(str(payload.email), payload.password)
    return AuthResponse(
        user=UserView.model_validate(result["user"]),
        workspace=WorkspaceView.model_validate(result["workspace"]),
        verification_token=result["verification_token"],
    )


@router.post("/verify-email", status_code=204)
def verify_email(payload: VerifyEmailRequest, service: Annotated[AuthService, Depends(auth_service)]) -> None:
    service.verify_email(payload.token)


@router.post("/login", response_model=AuthResponse, dependencies=[Depends(rate_limit_login)])
def login(
    payload: LoginRequest,
    response: Response,
    service: Annotated[AuthService, Depends(auth_service)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthResponse:
    csrf_token = new_csrf_token()
    result = service.login(str(payload.email), payload.password, csrf_token)
    response.set_cookie(
        "rta_session",
        result["session"].id,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
    )
    response.set_cookie("rta_csrf", csrf_token, httponly=False, samesite="lax", secure=settings.cookie_secure)
    return AuthResponse(
        user=UserView.model_validate(result["user"]),
        workspace=WorkspaceView.model_validate(result["workspace"]),
        csrf_token=csrf_token,
    )


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
    service: Annotated[AuthService, Depends(auth_service)],
) -> AuthResponse:
    result = service.request_password_reset(str(payload.email))
    return AuthResponse(
        user=UserView(id="00000000-0000-0000-0000-000000000000", email=payload.email, is_verified=False),
        workspace=WorkspaceView(id="00000000-0000-0000-0000-000000000000", name="not returned"),
        reset_token=result["reset_token"],
    )


@router.post("/password-reset/confirm", status_code=204)
def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    service: Annotated[AuthService, Depends(auth_service)],
) -> None:
    service.confirm_password_reset(payload.token, payload.password)


@router.get("/me", response_model=AuthResponse)
def me(context: Annotated[AuthContext, Depends(current_context)]) -> AuthResponse:
    workspace = context.user and context.session
    del workspace
    return AuthResponse(
        user=UserView.model_validate(context.user),
        workspace=WorkspaceView(id="active", name="Active workspace"),
        csrf_token=context.session.csrf_token,
    )
