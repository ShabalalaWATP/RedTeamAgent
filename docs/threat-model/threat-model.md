# Stage 2 Threat Model

## Assets

- User accounts, password hashes and sessions.
- Workspace-owned projects, reviews, sources, context packs, provider settings, runs and reports.
- Uploaded source originals and extracted evidence.
- Website snapshots, external research records, OCR text, transcripts and repository/code manifests.
- Provider credentials and model routing policy.
- Audit events and workflow history.

## Actors

- Anonymous user.
- Authenticated workspace user.
- Workspace owner, administrator, member and viewer.
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
