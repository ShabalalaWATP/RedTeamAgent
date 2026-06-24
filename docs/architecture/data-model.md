# Stage 1 Data Model

## Core Entities

- `User`: email, password hash, verification state.
- `Session`: HttpOnly cookie-backed server session.
- `Workspace`: tenant boundary. Stage 1 creates one personal workspace per user.
- `WorkspaceMembership`: user role in a workspace: owner, administrator, member or viewer.
- `Project`: workspace-owned review container.
- `Review`: project-owned proposal review with mode and focus chips.
- `Source`: uploaded or pasted evidence with extraction state, warnings, object key and metadata.
- `EvidenceChunk`: extracted text with locators and retrieval metadata.
- `ContextPack`: versioned Markdown context assigned to an agent.
- `ProviderConnection`: write-only provider credential and adapter configuration.
- `ModelRecord`: model capability snapshot and provenance.
- `ModelProfile`: routing profile assigned to agents.
- `Run`: review workflow instance and state.
- `RunEvent`: durable timeline event for SSE replay.
- `Report`: structured report, findings, evidence gaps and methodology.
- `AuditEvent`: structured audit record for security-sensitive actions.

## Tenant Boundary

Workspace ownership is the primary tenant boundary. Every workspace-owned resource carries a `workspace_id` directly or through a parent chain that is resolved by application services before access is allowed.
