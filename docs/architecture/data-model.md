# Stage 3 Data Model

## Core Entities

- `User`: email, password hash, verification state.
- `Session`: HttpOnly cookie-backed server session.
- `Workspace`: tenant boundary. Stage 1 creates one personal workspace per user.
- `WorkspaceMembership`: user role in a workspace: owner, administrator, member or viewer.
- `WorkspaceInvitation`: expiring invitation with role, inviter, token hash, accepted timestamp and audit metadata.
- `WorkspaceGovernance`: workspace-level provider, model, data-classification, region, purpose, retention, domain, identity and branding policy.
- `Project`: workspace-owned review container.
- `ProjectPermission`: optional finer-grained access record for a project when workspace membership is not specific enough.
- `Review`: project-owned proposal review with mode and focus chips.
- `Source`: uploaded, pasted, recorded, website, repository or external evidence with extraction state, warnings, object key and metadata.
- `EvidenceChunk`: extracted text with locators and a pgvector-compatible 16-dimension retrieval embedding.
- `ExternalSource`: reproducible research source with query, title, publisher, URL, publication date, access date, excerpt and quality score.
- `ActionItem`: report action with owner, status and due-date metadata.
- `EvaluationRun`: deterministic evaluation result for Stage 2 quality metrics.
- `ContextPack`: versioned Markdown context assigned to an agent.
- `ProviderConnection`: write-only provider credential and adapter configuration.
- `ModelRecord`: model capability snapshot, provenance, verification state and durable probe result.
- `ModelProfile`: routing profile assigned to agents.
- `Run`: review workflow instance and state.
- `RunEvent`: durable timeline event for SSE replay.
- `Report`: structured report, findings, evidence gaps and methodology.
- `ReportComment`: authorised collaboration comment linked to a report or finding.
- `ReportAction`: assigned action with owner, due date and status.
- `ReportShare`: expiring report share token with explicit access mode.
- `DecisionJournal`: initial confidence, final decision, rationale and linked report version.
- `Notification`: durable user/workspace notification for completed runs, failed runs, assignments and comments.
- `ScimMapping`: SCIM-ready external user or group mapping.
- `CustomAgentDefinition`: administrator-approved custom agent configuration with tool and schema boundaries.
- `CustomRiskRubric`: workspace or template rubric that changes scoring labels without changing report structure.
- `ReportTemplate`: selectable rendering template for structured reports.
- `ApiToken`: scoped integration token stored as a hash with prefix metadata, revocation state and rate limit.
- `WebhookEndpoint`: scoped endpoint with signing metadata, delivery policy and tenant boundary.
- `ScheduledReview`: idempotent re-review schedule with trigger type and next-run timestamp.
- `OutcomeRecord`: observed outcome linked to a predicted risk or action.
- `DataRequest`: export or deletion request with resumable status and audit metadata.
- `AuditEvent`: structured audit record for security-sensitive actions.

## Tenant Boundary

Workspace ownership is the primary tenant boundary. Every workspace-owned resource carries a `workspace_id` directly or through a parent chain that is resolved by application services before access is allowed.

## Stage 2 Source Metadata

Stage 2 source metadata records type-specific locators:

- presentations: slide numbers and text block indexes;
- spreadsheets: sheet names and cell ranges;
- images: OCR block identifiers, confidence and dimensions where available;
- audio and video: timestamp ranges and transcript confidence warnings;
- websites: final URL, access date, redirect chain, snapshot object key and excerpt locators;
- code archives and public repositories: manifest summary, language summary, dependency/config indexes and file path plus line-range locators.

Secret-like values are flagged or redacted in extracted chunks before any external processing path can use them.

## Stage 3 Governance Metadata

Provider and model allow-lists are stored as structured workspace governance arrays keyed by adapter, model identifier, data classification, region and task purpose. Empty allow-lists mean no additional restriction, not public sharing. Non-empty allow-lists fail closed before a provider connection, model record or run route is created.

Retention policies store a default retention period, legal hold flag and historical report preservation flag. Retention jobs may remove or anonymise collaboration data that is outside the preservation scope, but audit events remain factual records and must not be rewritten with sensitive raw content.
