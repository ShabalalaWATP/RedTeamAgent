# Stage 2 Data Model

## Core Entities

- `User`: email, password hash, verification state.
- `Session`: HttpOnly cookie-backed server session.
- `Workspace`: tenant boundary. Stage 1 creates one personal workspace per user.
- `WorkspaceMembership`: user role in a workspace: owner, administrator, member or viewer.
- `Project`: workspace-owned review container.
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
