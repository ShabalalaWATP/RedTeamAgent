# Stage 1 Threat Model

## Assets

- User accounts, password hashes and sessions.
- Workspace-owned projects, reviews, sources, context packs, provider settings, runs and reports.
- Uploaded source originals and extracted evidence.
- Provider credentials and model routing policy.
- Audit events and workflow history.

## Actors

- Anonymous user.
- Authenticated workspace user.
- Workspace owner, administrator, member and viewer.
- Malicious tenant attempting cross-workspace access.
- Malicious uploaded-source author.
- Misconfigured or malicious external provider endpoint.

## Entry Points

- Auth and password reset endpoints.
- Project, review, source, context pack, provider and run APIs.
- File upload and pasted text ingestion.
- Provider endpoint and credential submission.
- Server-Sent Events run streaming.
- Markdown and HTML report rendering.

## Trust Boundaries

See `trust-boundaries.mmd`.

## Abuse Cases

- IDOR access to another workspace resource.
- Prompt injection in source text trying to override provider routing or quality gates.
- MIME spoofing, oversized upload or malicious filename.
- Provider endpoint SSRF to private, loopback, link-local or metadata addresses.
- Schema-invalid model output.
- Credential disclosure in browser response, logs or errors.

## Security Controls

- Argon2id password hashing and HttpOnly sessions.
- Server-side workspace membership and role checks.
- CSRF token checks for authenticated mutation endpoints.
- File type, size and filename validation.
- Random object keys for source originals.
- Adapter endpoint validation with explicit self-hosted exception.
- Server-side provider credential encryption and write-only browser responses.
- Strict specialist output schemas and bounded fake-provider repair/failure paths.
- Structured report quality gate.
- Tests for tenant isolation, upload handling, prompt injection, endpoint validation and schema failure.
