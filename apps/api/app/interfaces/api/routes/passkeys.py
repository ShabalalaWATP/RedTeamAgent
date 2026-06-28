from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.application.passkey_service import PasskeyService
from app.core.config import Settings, get_settings
from app.interfaces.api.dependencies import AuthContext, current_context, passkey_service, require_csrf
from app.interfaces.api.schemas import (
    PasskeyAuthenticationVerifyRequest,
    PasskeyOptionsView,
    PasskeyRegistrationVerifyRequest,
    PasskeyStatusView,
)

router = APIRouter(prefix="/auth/passkeys", tags=["auth"])


@router.get("/status", response_model=PasskeyStatusView)
def passkey_status(
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[PasskeyService, Depends(passkey_service)],
) -> PasskeyStatusView:
    return PasskeyStatusView.model_validate(
        service.status(context.user.id, context.session.id, context.user.account_type)
    )


@router.post("/registration/options", response_model=PasskeyOptionsView, dependencies=[Depends(require_csrf)])
def passkey_registration_options(
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[PasskeyService, Depends(passkey_service)],
) -> PasskeyOptionsView:
    return PasskeyOptionsView(options=service.registration_options(context.user, context.session.id))


@router.post("/registration/verify", status_code=204, dependencies=[Depends(require_csrf)])
def passkey_registration_verify(
    payload: PasskeyRegistrationVerifyRequest,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[PasskeyService, Depends(passkey_service)],
) -> None:
    service.verify_registration(context.user.id, context.session.id, payload.credential, payload.name)


@router.post("/authentication/options", response_model=PasskeyOptionsView, dependencies=[Depends(require_csrf)])
def passkey_authentication_options(
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[PasskeyService, Depends(passkey_service)],
) -> PasskeyOptionsView:
    return PasskeyOptionsView(options=service.authentication_options(context.user.id, context.session.id))


@router.post("/authentication/verify", status_code=204, dependencies=[Depends(require_csrf)])
def passkey_authentication_verify(
    payload: PasskeyAuthenticationVerifyRequest,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[PasskeyService, Depends(passkey_service)],
) -> None:
    service.verify_authentication(context.user.id, context.session.id, payload.credential)


@router.delete("/{passkey_id}", status_code=204, dependencies=[Depends(require_csrf)])
def passkey_delete(
    passkey_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[PasskeyService, Depends(passkey_service)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    service.delete_passkey(context.user.id, passkey_id, context.user.account_type, settings.privileged_mfa_required)
