from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ApiError(BaseModel):
    code: str
    message: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12)


class LoginRequest(RegisterRequest):
    pass


class VerifyEmailRequest(BaseModel):
    token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirmRequest(BaseModel):
    token: str
    password: str = Field(min_length=12)


class UserView(BaseModel):
    id: str
    email: EmailStr
    is_verified: bool
    model_config = ConfigDict(from_attributes=True)


class WorkspaceView(BaseModel):
    id: str
    name: str
    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    user: UserView
    workspace: WorkspaceView
    csrf_token: str | None = None
    verification_token: str | None = None
    reset_token: str | None = None


class ProjectCreate(BaseModel):
    workspace_id: str
    title: str = Field(min_length=1, max_length=220)
    description: str = ""


class ProjectUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=220)
    description: str = ""


class ProjectView(BaseModel):
    id: str
    workspace_id: str
    title: str
    description: str
    model_config = ConfigDict(from_attributes=True)


class ReviewCreate(BaseModel):
    title: str = Field(min_length=1, max_length=220)
    proposal_text: str = Field(min_length=1)
    mode: Literal["basic", "standard", "in_depth"] = "standard"
    focus_chips: list[str] = Field(default_factory=list)
    external_research: bool = False
    private_research: bool = True
    domain_allowlist: list[str] = Field(default_factory=list)
    domain_blocklist: list[str] = Field(default_factory=list)


class ReviewView(BaseModel):
    id: str
    workspace_id: str
    project_id: str
    title: str
    proposal_text: str
    mode: str
    focus_chips: list[str]
    external_research: bool
    private_research: bool
    domain_allowlist: list[str]
    domain_blocklist: list[str]
    model_config = ConfigDict(from_attributes=True)


class PastedTextRequest(BaseModel):
    text: str = Field(min_length=1)


class WebsiteSourceRequest(BaseModel):
    url: str = Field(min_length=8, max_length=2048)


class RepositorySourceRequest(BaseModel):
    url: str = Field(min_length=8, max_length=2048)


class SourceView(BaseModel):
    id: str
    workspace_id: str
    review_id: str
    filename: str
    content_type: str
    state: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)


class ContextPackCreate(BaseModel):
    workspace_id: str
    name: str = Field(min_length=1)
    agent_key: str
    markdown: str = Field(min_length=1)


class ContextPackView(BaseModel):
    id: str
    workspace_id: str
    name: str
    agent_key: str
    markdown: str
    version: int
    model_config = ConfigDict(from_attributes=True)


class ProviderConnectionCreate(BaseModel):
    workspace_id: str
    adapter: str
    name: str
    config: dict[str, Any] = Field(default_factory=dict)
    credentials: dict[str, str] = Field(default_factory=dict)


class ProviderConnectionView(BaseModel):
    id: str
    workspace_id: str
    adapter: str
    name: str
    config: dict[str, Any]
    has_credentials: bool


class ModelCreate(BaseModel):
    workspace_id: str
    provider_connection_id: str
    model_identifier: str
    capabilities: list[str]
    provenance: str = "manual"
    verified: bool = False


class ModelView(BaseModel):
    id: str
    workspace_id: str
    provider_connection_id: str
    model_identifier: str
    capabilities: list[str]
    provenance: str
    verified: bool
    probe_result: dict[str, Any] = Field(default_factory=dict)
    model_config = ConfigDict(from_attributes=True)


class ProfileCreate(BaseModel):
    workspace_id: str
    name: str
    agent_key: str
    model_record_id: str
    explicit_pin: bool = False


class ProfileView(BaseModel):
    id: str
    workspace_id: str
    name: str
    agent_key: str
    model_record_id: str
    explicit_pin: bool
    model_config = ConfigDict(from_attributes=True)


class RunView(BaseModel):
    id: str
    workspace_id: str
    review_id: str
    state: str
    routing_plan: dict[str, Any]
    usage: dict[str, Any]
    model_config = ConfigDict(from_attributes=True)


class UsageLimitsView(BaseModel):
    daily_review_run_limit: int
    runs_started_today: int
    runs_remaining_today: int
    resets_at: datetime


class WorkflowSummaryView(BaseModel):
    id: str
    workspace_id: str
    review_id: str
    review_title: str
    project_id: str
    project_title: str
    mode: str
    state: str
    created_at: datetime
    selected_agents: list[str]
    top_risks: list[str]
    finding_count: int
    has_report: bool


class RunEventView(BaseModel):
    id: str
    run_id: str
    state: str
    message: str
    sequence: int
    model_config = ConfigDict(from_attributes=True)


class ReportView(BaseModel):
    id: str
    workspace_id: str
    run_id: str
    data: dict[str, Any]
    model_config = ConfigDict(from_attributes=True)


class ReportComparisonView(BaseModel):
    left_run_id: str
    right_run_id: str
    changed_risks: list[str]
    changed_assumptions: list[str]
    changed_evidence_gaps: list[str]
    changed_recommendations: list[str]


class EvaluationResultView(BaseModel):
    workspace_id: str
    fixture_count: int
    metrics: dict[str, float]
    adversarial_fixtures: list[str]
    live_smoke_tests: str


def source_view(source: Any) -> SourceView:
    return SourceView(
        id=source.id,
        workspace_id=source.workspace_id,
        review_id=source.review_id,
        filename=source.filename,
        content_type=source.content_type,
        state=source.state,
        metadata=source.metadata_json,
        warnings=source.warnings,
    )
