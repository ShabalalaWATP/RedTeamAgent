from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class OrganisationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)


class OrganisationView(BaseModel):
    id: str
    name: str
    workspace_type: str


class MemberView(BaseModel):
    workspace_id: str
    user_id: str
    email: EmailStr
    role: str


class InvitationCreate(BaseModel):
    email: EmailStr
    role: str = "member"


class InvitationAccept(BaseModel):
    token: str


class InvitationView(BaseModel):
    id: str
    workspace_id: str
    email: EmailStr
    role: str
    expires_at: datetime
    accepted_at: datetime | None = None
    token: str | None = None


class ProjectPermissionSet(BaseModel):
    user_id: str
    permission: str = "editor"


class ProjectPermissionView(BaseModel):
    id: str
    project_id: str
    workspace_id: str
    user_id: str
    permission: str
    model_config = ConfigDict(from_attributes=True)


class ReportCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    finding_id: str | None = None


class ReportCommentView(BaseModel):
    id: str
    report_id: str
    workspace_id: str
    author_user_id: str
    finding_id: str | None = None
    body: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ReportActionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    owner_user_id: str | None = None
    due_at: datetime | None = None
    status: str = "open"


class ReportActionUpdate(BaseModel):
    status: str


class ReportActionView(BaseModel):
    id: str
    report_id: str
    workspace_id: str
    title: str
    owner_user_id: str | None = None
    due_at: datetime | None = None
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DecisionJournalCreate(BaseModel):
    report_id: str
    initial_confidence: str
    final_decision: str
    rationale: str = Field(min_length=1)


class DecisionJournalView(BaseModel):
    id: str
    review_id: str
    report_id: str
    workspace_id: str
    initial_confidence: str
    final_decision: str
    rationale: str
    created_by_user_id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ReportShareCreate(BaseModel):
    access_mode: str = "view"
    expires_at: datetime


class ReportShareView(BaseModel):
    id: str
    report_id: str
    workspace_id: str
    access_mode: str
    expires_at: datetime
    revoked: bool
    token: str | None = None


class SharedReportView(BaseModel):
    report_id: str
    access_mode: str
    data: dict[str, Any]


class GovernanceUpdate(BaseModel):
    provider_allowlist: list[str] = Field(default_factory=list)
    model_allowlist: list[str] = Field(default_factory=list)
    data_classification_allowlist: list[str] = Field(default_factory=list)
    region_allowlist: list[str] = Field(default_factory=list)
    purpose_allowlist: list[str] = Field(default_factory=list)
    approved_domains: list[str] = Field(default_factory=list)
    retention_days: int = Field(default=365, ge=1)
    preserve_historical_reports: bool = True
    legal_hold: bool = False
    mfa_required: bool = False
    sso_provider: str | None = None
    custom_branding: dict[str, Any] = Field(default_factory=dict)


class GovernanceView(GovernanceUpdate):
    workspace_id: str
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ScimMappingCreate(BaseModel):
    external_id: str
    kind: str
    local_subject_id: str
    display_name: str


class ScimMappingView(ScimMappingCreate):
    id: str
    workspace_id: str
    model_config = ConfigDict(from_attributes=True)


class NotificationView(BaseModel):
    id: str
    workspace_id: str
    user_id: str | None = None
    kind: str
    title: str
    body: str
    read: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CustomAgentCreate(BaseModel):
    name: str
    instructions: str = Field(min_length=1)
    tool_permissions: list[str] = Field(default_factory=list)
    output_schema: dict[str, Any] = Field(default_factory=dict)
    enabled: bool = False


class CustomAgentView(CustomAgentCreate):
    id: str
    workspace_id: str
    approved_by_user_id: str
    model_config = ConfigDict(from_attributes=True)


class RiskRubricCreate(BaseModel):
    name: str
    levels: list[dict[str, Any]] = Field(default_factory=list)
    active: bool = True


class RiskRubricView(RiskRubricCreate):
    id: str
    workspace_id: str
    model_config = ConfigDict(from_attributes=True)


class ReportTemplateCreate(BaseModel):
    name: str
    sections: list[str] = Field(default_factory=list)
    active: bool = True


class ReportTemplateView(ReportTemplateCreate):
    id: str
    workspace_id: str
    model_config = ConfigDict(from_attributes=True)


class ApiTokenCreate(BaseModel):
    name: str
    scopes: list[str] = Field(default_factory=list)
    rate_limit_per_minute: int = Field(default=60, ge=1, le=600)


class ApiTokenView(BaseModel):
    id: str
    workspace_id: str
    name: str
    token_prefix: str
    scopes: list[str]
    rate_limit_per_minute: int
    revoked: bool
    plain_token: str | None = None


class WebhookCreate(BaseModel):
    name: str
    url: str
    events: list[str] = Field(default_factory=list)
    enabled: bool = True


class WebhookView(BaseModel):
    id: str
    workspace_id: str
    name: str
    url: str
    events: list[str]
    enabled: bool
    signing_secret: str | None = None


class WebhookSignRequest(BaseModel):
    signing_secret: str
    body: dict[str, Any] = Field(default_factory=dict)


class WebhookVerifyRequest(WebhookSignRequest):
    timestamp: int
    signature: str


class ScheduledReviewCreate(BaseModel):
    review_id: str
    trigger: str
    interval_days: int = Field(default=30, ge=1)
    next_run_at: datetime
    enabled: bool = True


class ScheduledReviewView(ScheduledReviewCreate):
    id: str
    workspace_id: str
    last_run_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class OutcomeCreate(BaseModel):
    report_id: str
    risk_id: str
    materialised: bool
    notes: str = ""


class OutcomeView(OutcomeCreate):
    id: str
    workspace_id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DataRequestCreate(BaseModel):
    request_type: str


class DataRequestView(BaseModel):
    id: str
    workspace_id: str
    requested_by_user_id: str
    request_type: str
    status: str
    result: dict[str, Any]
    created_at: datetime
    completed_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class AuditEventView(BaseModel):
    id: str
    workspace_id: str | None
    actor_user_id: str | None
    action: str
    metadata: dict[str, Any]
    created_at: datetime
