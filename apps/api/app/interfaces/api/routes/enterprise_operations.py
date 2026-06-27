from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.application.enterprise_operations_service import EnterpriseOperationsService
from app.interfaces.api.dependencies import (
    AuthContext,
    current_context,
    enterprise_operations_service,
    require_csrf,
)
from app.interfaces.api.enterprise_schemas import AuditEventView, DataRequestCreate, DataRequestView

router = APIRouter(prefix="/enterprise", tags=["enterprise-operations"])


@router.get("/workspaces/{workspace_id}/operations")
def operations_summary(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> dict[str, object]:
    return service.operations_summary(context.user.id, workspace_id)


@router.get("/workspaces/{workspace_id}/model-comparison")
def model_comparison(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> dict[str, object]:
    return service.model_comparison(context.user.id, workspace_id)


@router.get("/workspaces/{workspace_id}/audit", response_model=list[AuditEventView])
def list_audit(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> list[AuditEventView]:
    return [_audit_view(event) for event in service.list_audit(context.user.id, workspace_id)]


@router.get("/runs/{run_id}/inspector")
def run_inspector(
    run_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> dict[str, object]:
    return service.run_inspector(context.user.id, run_id)


@router.post(
    "/workspaces/{workspace_id}/data-requests",
    response_model=DataRequestView,
    dependencies=[Depends(require_csrf)],
)
def request_data(
    workspace_id: str,
    payload: DataRequestCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> DataRequestView:
    item = service.request_data(context.user.id, workspace_id, payload.request_type)
    return DataRequestView.model_validate(item)


@router.get("/workspaces/{workspace_id}/data-requests", response_model=list[DataRequestView])
def list_data_requests(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> list[DataRequestView]:
    return [DataRequestView.model_validate(item) for item in service.list_data_requests(context.user.id, workspace_id)]


@router.post(
    "/workspaces/{workspace_id}/data-export",
    response_model=DataRequestView,
    dependencies=[Depends(require_csrf)],
)
def data_export(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> DataRequestView:
    item = service.request_data(context.user.id, workspace_id, "export")
    return DataRequestView.model_validate(item)


@router.post("/workspaces/{workspace_id}/retention/enforce", dependencies=[Depends(require_csrf)])
def enforce_retention(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseOperationsService, Depends(enterprise_operations_service)],
) -> dict[str, int]:
    return service.enforce_retention(context.user.id, workspace_id)


def _audit_view(event: Any) -> AuditEventView:
    return AuditEventView(
        id=event.id,
        workspace_id=event.workspace_id,
        actor_user_id=event.actor_user_id,
        action=event.action,
        metadata=event.metadata_json,
        created_at=event.created_at,
    )
