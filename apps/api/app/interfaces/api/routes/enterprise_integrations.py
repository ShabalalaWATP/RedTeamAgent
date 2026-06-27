from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Depends

from app.application.enterprise_operations_service import EnterpriseOperationsService
from app.interfaces.api.dependencies import (
    AuthContext,
    current_context,
    enterprise_operations_service,
    rate_limit_public_webhook,
    require_csrf,
)
from app.interfaces.api.enterprise_schemas import (
    ApiTokenCreate,
    ApiTokenView,
    OutcomeCreate,
    OutcomeView,
    ScheduledReviewCreate,
    ScheduledReviewView,
    WebhookCreate,
    WebhookSignRequest,
    WebhookVerifyRequest,
    WebhookView,
)

router = APIRouter(prefix="/enterprise", tags=["enterprise-integrations"])


@router.post("/workspaces/{workspace_id}/api-tokens", response_model=ApiTokenView, dependencies=[Depends(require_csrf)])
def create_api_token(
    workspace_id: str,
    payload: ApiTokenCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> ApiTokenView:
    return ApiTokenView.model_validate(service.create_api_token(context.user.id, workspace_id, payload.model_dump()))


@router.get("/workspaces/{workspace_id}/api-tokens", response_model=list[ApiTokenView])
def list_api_tokens(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> list[ApiTokenView]:
    return [ApiTokenView.model_validate(item) for item in service.list_api_tokens(context.user.id, workspace_id)]


@router.delete(
    "/workspaces/{workspace_id}/api-tokens/{token_id}",
    response_model=ApiTokenView,
    dependencies=[Depends(require_csrf)],
)
def revoke_api_token(
    workspace_id: str,
    token_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> ApiTokenView:
    return ApiTokenView.model_validate(service.revoke_api_token(context.user.id, workspace_id, token_id))


@router.post("/workspaces/{workspace_id}/webhooks", response_model=WebhookView, dependencies=[Depends(require_csrf)])
def create_webhook(
    workspace_id: str,
    payload: WebhookCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> WebhookView:
    return WebhookView.model_validate(service.create_webhook(context.user.id, workspace_id, payload.model_dump()))


@router.get("/workspaces/{workspace_id}/webhooks", response_model=list[WebhookView])
def list_webhooks(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> list[WebhookView]:
    return [WebhookView.model_validate(item) for item in service.list_webhooks(context.user.id, workspace_id)]


@router.post("/webhooks/{webhook_id}/sign-test", dependencies=[Depends(require_csrf)])
def sign_webhook_test(
    webhook_id: str,
    payload: WebhookSignRequest,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> dict[str, object]:
    body = json.dumps(payload.body, sort_keys=True).encode("utf-8")
    return service.sign_webhook_test(context.user.id, webhook_id, payload.signing_secret, body)


@router.post("/webhooks/{webhook_id}/verify", dependencies=[Depends(rate_limit_public_webhook)])
def verify_webhook(
    webhook_id: str,
    payload: WebhookVerifyRequest,
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> dict[str, str]:
    body = json.dumps(payload.body, sort_keys=True).encode("utf-8")
    return service.verify_webhook(
        webhook_id,
        payload.signing_secret,
        body,
        payload.timestamp,
        payload.signature,
    )


@router.post(
    "/workspaces/{workspace_id}/scheduled-reviews",
    response_model=ScheduledReviewView,
    dependencies=[Depends(require_csrf)],
)
def create_scheduled_review(
    workspace_id: str,
    payload: ScheduledReviewCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> ScheduledReviewView:
    item = service.create_scheduled_review(context.user.id, workspace_id, payload.model_dump())
    return ScheduledReviewView.model_validate(item)


@router.get("/workspaces/{workspace_id}/scheduled-reviews", response_model=list[ScheduledReviewView])
def list_scheduled_reviews(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> list[ScheduledReviewView]:
    items = service.list_scheduled_reviews(context.user.id, workspace_id)
    return [ScheduledReviewView.model_validate(item) for item in items]


@router.post("/workspaces/{workspace_id}/scheduled-reviews/run-due", dependencies=[Depends(require_csrf)])
def run_due_scheduled_reviews(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> dict[str, int]:
    return service.run_due_scheduled_reviews(context.user.id, workspace_id)


@router.post("/workspaces/{workspace_id}/outcomes", response_model=OutcomeView, dependencies=[Depends(require_csrf)])
def create_outcome(
    workspace_id: str,
    payload: OutcomeCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> OutcomeView:
    return OutcomeView.model_validate(service.create_outcome(context.user.id, workspace_id, payload.model_dump()))


@router.get("/workspaces/{workspace_id}/outcomes", response_model=list[OutcomeView])
def list_outcomes(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> list[OutcomeView]:
    return [OutcomeView.model_validate(item) for item in service.list_outcomes(context.user.id, workspace_id)]
