from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ApiError(BaseModel):
    code: str
    message: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    captcha_token: str | None = Field(default=None, max_length=4096)
    site_owner_bootstrap_token: str | None = Field(default=None, max_length=4096)


class LoginRequest(RegisterRequest):
    captcha_token: None = None
    site_owner_bootstrap_token: None = None
    mfa_code: str | None = Field(default=None, max_length=64)


class VerifyEmailRequest(BaseModel):
    token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr
    captcha_token: str | None = Field(default=None, max_length=4096)


class PasswordResetConfirmRequest(BaseModel):
    token: str
    password: str = Field(min_length=12, max_length=128)


class UserView(BaseModel):
    id: str
    email: EmailStr
    is_verified: bool
    account_type: str = "user"
    account_status: str = "active"
    model_config = ConfigDict(from_attributes=True)


class WorkspaceView(BaseModel):
    id: str
    name: str
    model_config = ConfigDict(from_attributes=True)


class MfaRequirementView(BaseModel):
    required: bool = False
    authenticator_app_enabled: bool = False
    passkey_registered: bool = False
    passkey_verified: bool = False
    setup_required: bool = False
    passkey_verification_required: bool = False


class AuthResponse(BaseModel):
    user: UserView
    workspace: WorkspaceView
    workspace_role: str | None = None
    csrf_token: str | None = None
    verification_token: str | None = None
    reset_token: str | None = None
    mfa_requirements: MfaRequirementView = Field(default_factory=MfaRequirementView)
    mfa_setup_required: bool = False
    passkey_verification_required: bool = False


class CaptchaChallengeView(BaseModel):
    required: bool
    provider: Literal["disabled", "turnstile", "challenge"]
    token: str = Field(default="", max_length=4096)
    prompt: str = Field(default="", max_length=120)
    expires_in_seconds: int = Field(default=0, ge=0, le=900)


class MfaStatusView(BaseModel):
    enabled: bool
    required: bool = False


class MfaSetupView(BaseModel):
    enabled: bool
    secret: str
    provisioning_uri: str
    recovery_codes: list[str]


class MfaCodeRequest(BaseModel):
    code: str = Field(min_length=6, max_length=64)


class PasskeyCredentialView(BaseModel):
    id: str
    name: str
    created_at: datetime
    last_used_at: datetime | None = None


class PasskeyStatusView(MfaRequirementView):
    registered: bool = False
    count: int = 0
    credentials: list[PasskeyCredentialView] = Field(default_factory=list)


class PasskeyOptionsView(BaseModel):
    options: dict[str, Any]


class PasskeyRegistrationVerifyRequest(BaseModel):
    credential: dict[str, Any]
    name: str | None = Field(default=None, max_length=120)


class PasskeyAuthenticationVerifyRequest(BaseModel):
    credential: dict[str, Any]


class ProjectCreate(BaseModel):
    workspace_id: str
    title: str = Field(min_length=1, max_length=220)
    description: str = Field(default="", max_length=5000)


class ProjectUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=220)
    description: str = Field(default="", max_length=5000)


class ProjectView(BaseModel):
    id: str
    workspace_id: str
    created_by_user_id: str | None = None
    title: str
    description: str
    model_config = ConfigDict(from_attributes=True)


class ReviewCreate(BaseModel):
    title: str = Field(min_length=1, max_length=220)
    proposal_text: str = Field(min_length=1, max_length=50000)
    mode: Literal["basic", "standard", "in_depth"] = "standard"
    focus_chips: list[str] = Field(default_factory=list, max_length=12)
    external_research: bool = False
    private_research: bool = True
    domain_allowlist: list[str] = Field(default_factory=list, max_length=25)
    domain_blocklist: list[str] = Field(default_factory=list, max_length=25)


class StandaloneReviewCreate(ReviewCreate):
    workspace_id: str


class ReviewUpdate(ReviewCreate):
    pass


class ReviewView(BaseModel):
    id: str
    workspace_id: str
    project_id: str | None
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
    text: str = Field(min_length=1, max_length=50000)


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
    name: str = Field(min_length=1, max_length=220)
    agent_key: str = Field(min_length=1, max_length=80)
    markdown: str = Field(min_length=1, max_length=50000)


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
    adapter: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=160)
    config: dict[str, Any] = Field(default_factory=dict)
    credentials: dict[str, str] = Field(default_factory=dict)


class ProviderConnectionView(BaseModel):
    id: str
    workspace_id: str
    adapter: str
    name: str
    config: dict[str, Any]
    has_credentials: bool


class ModelPreviewRequest(BaseModel):
    workspace_id: str
    adapter: str = Field(min_length=1, max_length=80)
    config: dict[str, Any] = Field(default_factory=dict)
    credentials: dict[str, str] = Field(default_factory=dict)


class ModelPreviewView(BaseModel):
    model_identifier: str
    capabilities: list[str]
    provenance: str
    verified: bool
    probe_result: dict[str, Any] = Field(default_factory=dict)


class ModelCreate(BaseModel):
    workspace_id: str
    provider_connection_id: str
    model_identifier: str = Field(min_length=1, max_length=160)
    capabilities: list[str] = Field(default_factory=list, max_length=20)
    provenance: str = Field(default="manual", max_length=120)
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
    name: str = Field(min_length=1, max_length=160)
    agent_key: str = Field(min_length=1, max_length=80)
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
    account_type: str
    tier_name: str
    project_limit: int | None
    projects_used: int
    projects_remaining: int | None
    workflow_total_limit: int | None
    workflows_used: int
    workflows_remaining: int | None
    workflow_weekly_limit: int | None
    workflows_started_this_week: int
    weekly_workflows_remaining: int | None
    resets_at: datetime
    daily_review_run_limit: int | None = None
    runs_started_today: int = 0
    runs_remaining_today: int | None = None


class WorkflowSummaryView(BaseModel):
    id: str
    workspace_id: str
    review_id: str
    review_title: str
    project_id: str | None
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
