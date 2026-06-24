from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.application.enterprise_service import EnterpriseService
from app.interfaces.api.dependencies import AuthContext, current_context, enterprise_service, require_csrf
from app.interfaces.api.enterprise_schemas import (
    DecisionJournalCreate,
    DecisionJournalView,
    ProjectPermissionSet,
    ProjectPermissionView,
    ReportActionCreate,
    ReportActionUpdate,
    ReportActionView,
    ReportCommentCreate,
    ReportCommentView,
    ReportShareCreate,
    ReportShareView,
    SharedReportView,
)

router = APIRouter(prefix="/enterprise", tags=["enterprise-collaboration"])


@router.put(
    "/projects/{project_id}/permissions",
    response_model=ProjectPermissionView,
    dependencies=[Depends(require_csrf)],
)
def set_project_permission(
    project_id: str,
    payload: ProjectPermissionSet,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> ProjectPermissionView:
    item = service.set_project_permission(context.user.id, project_id, payload.user_id, payload.permission)
    return ProjectPermissionView.model_validate(item)


@router.get("/projects/{project_id}/permissions", response_model=list[ProjectPermissionView])
def list_project_permissions(
    project_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> list[ProjectPermissionView]:
    items = service.list_project_permissions(context.user.id, project_id)
    return [ProjectPermissionView.model_validate(item) for item in items]


@router.post("/reports/{report_id}/comments", response_model=ReportCommentView, dependencies=[Depends(require_csrf)])
def add_comment(
    report_id: str,
    payload: ReportCommentCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> ReportCommentView:
    item = service.add_comment(context.user.id, report_id, payload.body, payload.finding_id)
    return ReportCommentView.model_validate(item)


@router.get("/reports/{report_id}/comments", response_model=list[ReportCommentView])
def list_comments(
    report_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> list[ReportCommentView]:
    return [ReportCommentView.model_validate(item) for item in service.list_comments(context.user.id, report_id)]


@router.post("/reports/{report_id}/actions", response_model=ReportActionView, dependencies=[Depends(require_csrf)])
def create_action(
    report_id: str,
    payload: ReportActionCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> ReportActionView:
    item = service.create_action(context.user.id, report_id, payload.model_dump())
    return ReportActionView.model_validate(item)


@router.patch(
    "/reports/{report_id}/actions/{action_id}",
    response_model=ReportActionView,
    dependencies=[Depends(require_csrf)],
)
def update_action(
    report_id: str,
    action_id: str,
    payload: ReportActionUpdate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> ReportActionView:
    item = service.update_action(context.user.id, report_id, action_id, payload.status)
    return ReportActionView.model_validate(item)


@router.get("/reports/{report_id}/actions", response_model=list[ReportActionView])
def list_actions(
    report_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> list[ReportActionView]:
    return [ReportActionView.model_validate(item) for item in service.list_actions(context.user.id, report_id)]


@router.post(
    "/reviews/{review_id}/decision-journal",
    response_model=DecisionJournalView,
    dependencies=[Depends(require_csrf)],
)
def add_journal(
    review_id: str,
    payload: DecisionJournalCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> DecisionJournalView:
    item = service.add_journal(context.user.id, review_id, payload.model_dump())
    return DecisionJournalView.model_validate(item)


@router.get("/reviews/{review_id}/decision-journal", response_model=list[DecisionJournalView])
def list_journal(
    review_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> list[DecisionJournalView]:
    return [DecisionJournalView.model_validate(item) for item in service.list_journal(context.user.id, review_id)]


@router.post("/reports/{report_id}/shares", response_model=ReportShareView, dependencies=[Depends(require_csrf)])
def create_share(
    report_id: str,
    payload: ReportShareCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> ReportShareView:
    item = service.create_share(context.user.id, report_id, payload.access_mode, payload.expires_at)
    return ReportShareView.model_validate(item)


@router.get("/reports/{report_id}/shares", response_model=list[ReportShareView])
def list_shares(
    report_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> list[ReportShareView]:
    return [ReportShareView.model_validate(item) for item in service.list_shares(context.user.id, report_id)]


@router.get("/shared-reports/{token}", response_model=SharedReportView)
def access_share(
    token: str,
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> SharedReportView:
    return SharedReportView.model_validate(service.access_share(token))
