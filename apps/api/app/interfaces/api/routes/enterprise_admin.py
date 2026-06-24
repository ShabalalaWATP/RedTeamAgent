from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.application.enterprise_service import EnterpriseService
from app.interfaces.api.dependencies import AuthContext, current_context, enterprise_service, require_csrf
from app.interfaces.api.enterprise_schemas import (
    CustomAgentCreate,
    CustomAgentView,
    GovernanceUpdate,
    GovernanceView,
    InvitationAccept,
    InvitationCreate,
    InvitationView,
    MemberView,
    NotificationView,
    OrganisationCreate,
    OrganisationView,
    ReportTemplateCreate,
    ReportTemplateView,
    RiskRubricCreate,
    RiskRubricView,
    ScimMappingCreate,
    ScimMappingView,
)

router = APIRouter(prefix="/enterprise", tags=["enterprise-admin"])


@router.post("/workspaces", response_model=OrganisationView, dependencies=[Depends(require_csrf)])
def create_workspace(
    payload: OrganisationCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> OrganisationView:
    return OrganisationView.model_validate(service.create_workspace(context.user.id, payload.name))


@router.get("/workspaces/{workspace_id}/members", response_model=list[MemberView])
def list_members(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> list[MemberView]:
    return [MemberView.model_validate(item) for item in service.list_members(context.user.id, workspace_id)]


@router.post(
    "/workspaces/{workspace_id}/invitations",
    response_model=InvitationView,
    dependencies=[Depends(require_csrf)],
)
def invite_member(
    workspace_id: str,
    payload: InvitationCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> InvitationView:
    invitation = service.invite_member(context.user.id, workspace_id, str(payload.email), payload.role)
    return InvitationView.model_validate(invitation)


@router.get("/workspaces/{workspace_id}/invitations", response_model=list[InvitationView])
def list_invitations(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> list[InvitationView]:
    return [InvitationView.model_validate(item) for item in service.list_invitations(context.user.id, workspace_id)]


@router.post("/invitations/accept", response_model=MemberView, dependencies=[Depends(require_csrf)])
def accept_invitation(
    payload: InvitationAccept,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> MemberView:
    membership = service.accept_invitation(context.user.id, payload.token)
    user_email = context.user.email
    return MemberView.model_validate(membership | {"email": user_email})


@router.get("/workspaces/{workspace_id}/governance", response_model=GovernanceView)
def get_governance(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> GovernanceView:
    return GovernanceView.model_validate(service.get_governance(context.user.id, workspace_id))


@router.put(
    "/workspaces/{workspace_id}/governance",
    response_model=GovernanceView,
    dependencies=[Depends(require_csrf)],
)
def update_governance(
    workspace_id: str,
    payload: GovernanceUpdate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> GovernanceView:
    governance = service.update_governance(context.user.id, workspace_id, payload.model_dump())
    return GovernanceView.model_validate(governance)


@router.get("/workspaces/{workspace_id}/identity", response_model=GovernanceView)
def get_identity(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> GovernanceView:
    return GovernanceView.model_validate(service.get_governance(context.user.id, workspace_id))


@router.put("/workspaces/{workspace_id}/identity", response_model=GovernanceView, dependencies=[Depends(require_csrf)])
def update_identity(
    workspace_id: str,
    payload: GovernanceUpdate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> GovernanceView:
    return GovernanceView.model_validate(service.update_governance(context.user.id, workspace_id, payload.model_dump()))


@router.post(
    "/workspaces/{workspace_id}/scim-mappings",
    response_model=ScimMappingView,
    dependencies=[Depends(require_csrf)],
)
def create_scim_mapping(
    workspace_id: str,
    payload: ScimMappingCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> ScimMappingView:
    item = service.create_scim_mapping(context.user.id, workspace_id, payload.model_dump())
    return ScimMappingView.model_validate(item)


@router.get("/workspaces/{workspace_id}/scim-mappings", response_model=list[ScimMappingView])
def list_scim_mappings(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> list[ScimMappingView]:
    return [ScimMappingView.model_validate(item) for item in service.list_scim_mappings(context.user.id, workspace_id)]


@router.get("/workspaces/{workspace_id}/notifications", response_model=list[NotificationView])
def list_notifications(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> list[NotificationView]:
    return [NotificationView.model_validate(item) for item in service.list_notifications(context.user.id, workspace_id)]


@router.post(
    "/workspaces/{workspace_id}/custom-agents",
    response_model=CustomAgentView,
    dependencies=[Depends(require_csrf)],
)
def create_custom_agent(
    workspace_id: str,
    payload: CustomAgentCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> CustomAgentView:
    item = service.create_custom_agent(context.user.id, workspace_id, payload.model_dump())
    return CustomAgentView.model_validate(item)


@router.get("/workspaces/{workspace_id}/custom-agents", response_model=list[CustomAgentView])
def list_custom_agents(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> list[CustomAgentView]:
    return [CustomAgentView.model_validate(item) for item in service.list_custom_agents(context.user.id, workspace_id)]


@router.post("/workspaces/{workspace_id}/rubrics", response_model=RiskRubricView, dependencies=[Depends(require_csrf)])
def create_rubric(
    workspace_id: str,
    payload: RiskRubricCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> RiskRubricView:
    item = service.create_named_config(context.user.id, workspace_id, "rubric", payload.model_dump())
    return RiskRubricView.model_validate(item)


@router.get("/workspaces/{workspace_id}/rubrics", response_model=list[RiskRubricView])
def list_rubrics(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> list[RiskRubricView]:
    items = service.list_named_config(context.user.id, workspace_id, "rubric")
    return [RiskRubricView.model_validate(item) for item in items]


@router.post(
    "/workspaces/{workspace_id}/templates",
    response_model=ReportTemplateView,
    dependencies=[Depends(require_csrf)],
)
def create_template(
    workspace_id: str,
    payload: ReportTemplateCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> ReportTemplateView:
    item = service.create_named_config(context.user.id, workspace_id, "template", payload.model_dump())
    return ReportTemplateView.model_validate(item)


@router.get("/workspaces/{workspace_id}/templates", response_model=list[ReportTemplateView])
def list_templates(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EnterpriseService, Depends(enterprise_service)],
) -> list[ReportTemplateView]:
    items = service.list_named_config(context.user.id, workspace_id, "template")
    return [ReportTemplateView.model_validate(item) for item in items]
