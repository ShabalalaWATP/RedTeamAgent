# Stage 3 Threat Model

## Assets

- User accounts, password hashes and sessions.
- Workspace-owned projects, reviews, sources, context packs, provider settings, runs and reports.
- Uploaded source originals and extracted evidence.
- Website snapshots, external research records, OCR text, transcripts and repository/code manifests.
- Provider credentials and model routing policy.
- Organisation membership, invitations, project-level permissions and SSO/MFA/SCIM mappings.
- Report shares, comments, action assignments, decision journals and notifications.
- API tokens, webhook secrets, custom agents, rubrics, templates and scheduled-review configuration.
- Retention, export and deletion request records.
- Audit events and workflow history.

## Actors

- Anonymous user.
- Authenticated workspace user.
- Workspace owner, administrator, member and viewer.
- Organisation administrator managing identity, provider governance, retention and integrations.
- External collaborator accessing a report through an expiring share link.
- Integration client using an API token or receiving a webhook.
- Malicious tenant attempting cross-workspace access.
- Malicious uploaded-source author.
- Malicious website, public repository, archive or media file author.
- External search result poisoning attacker.
- Misconfigured or malicious external provider endpoint.

## Entry Points

- Auth and password reset endpoints.
- Project, review, source, context pack, provider and run APIs.
- File upload and pasted text ingestion.
- Website URL, public repository URL, code archive, image, audio, video and browser-recorded source ingestion.
- External research query generation and search-provider egress.
- Provider endpoint and credential submission.
- Workspace invitations, report shares, API token creation and webhook registration.
- Custom agent, rubric, template and scheduled-review configuration.
- Export, deletion and retention endpoints.
- Server-Sent Events run streaming.
- Markdown and HTML report rendering.

## Trust Boundaries

See `trust-boundaries.mmd`.

## Abuse Cases

- IDOR access to another workspace resource.
- Prompt injection in source text trying to override provider routing or quality gates.
- MIME spoofing, oversized upload or malicious filename.
- SSRF through website ingestion, redirects, DNS rebinding, IPv6 literals or blocked schemes.
- Archive path traversal, symlinks, nested archives, decompression bombs or malicious filenames.
- Prompt injection in PDFs, website content, OCR text, transcripts and code comments.
- Confidential source text leaking into external search queries.
- Repository ingestion executing untrusted code.
- Provider endpoint SSRF to private, loopback, link-local or metadata addresses.
- Schema-invalid model output.
- Credential disclosure in browser response, logs or errors.
- Invitation token guessing, reuse or privilege escalation.
- Report-share access after expiry or across tenants.
- API token misuse, plaintext storage or unscoped access.
- Webhook replay, stale signatures or cross-tenant payload leakage.
- Custom agent prompt injection attempting to bypass tool, context, provider or output-schema policy.
- Retention jobs deleting preserved report history or mutating audit facts incorrectly.

## Security Controls

- Argon2id password hashing and HttpOnly sessions.
- Server-side workspace membership and role checks.
- CSRF token checks for authenticated mutation endpoints.
- File type, size and filename validation.
- Hardened website fetch policy with scheme allow-listing, DNS revalidation, redirect revalidation, timeout and size caps, and private-network blocking.
- Archive unpacking policy that rejects traversal, symlinks, nested archives and excessive expansion.
- Code ingestion stores manifests and text only; uploaded or cloned code is never executed.
- External research requires explicit per-review permission. Private research mode uses sanitised generic queries.
- Search results are stored as external source records with quality scores and access dates.
- Random object keys for source originals.
- Adapter endpoint validation with explicit self-hosted exception.
- Server-side provider credential encryption and write-only browser responses.
- Strict specialist output schemas and bounded fake-provider repair/failure paths.
- Structured report quality gate.
- Tests for tenant isolation, upload handling, prompt injection, endpoint validation, archive safety, website SSRF, external research policy, PDF export sanitisation and schema failure.
- Invitation and report-share tokens are random, hashed at rest and expire.
- RBAC and project-level permission checks are centralised in application services.
- Provider and model governance is deterministic and checked before provider or model use.
- API tokens are scoped, revocable, rate-limited and stored only as hashes with prefixes.
- Webhooks use timestamped HMAC signatures with replay rejection.
- Custom agents are administrator-approved configuration and cannot grant tool permissions or provider bypasses.
- Retention and data requests emit audit events and preserve historical report facts.
- Production deployment uses strict CSP, secure headers, cookie settings, CORS allow-lists and documented scan/SBOM gates.

## Audit Tamper-Evidence Control

The local developer profile stores audit events in the application database. Production deployments must send the same structured audit events to append-only storage, such as object-locking object storage or a managed immutable log sink, with hash-chain verification enabled by the log platform. Until that production sink is configured, the documented compensating control is restricted administrator database access plus daily signed database backups.
