# Release Gates

## Stage 1 Gates

- Backend unit coverage at or above 95 percent.
- Frontend unit coverage at or above 95 percent.
- TypeScript strict mode passes.
- Python type checking passes.
- Formatting and linting pass.
- Line-count check passes.
- Architecture-boundary tests pass.
- Security acceptance tests pass.
- End-to-end review workflow passes.
- WCAG 2.2 AA accessibility checks pass on auth, dashboard, new review, report, workflows and provider settings screens.
- Keyboard-only navigation reaches the core login, new review, source upload, run, report filter and provider settings controls.
- Visual regression baselines pass on auth, dashboard, new review, report, workflows and provider settings screens at desktop and mobile breakpoints in dark and light themes.
- Responsive checks pass at 360 px, 390 px, 768 px, 1024 px, 1440 px and 1920 px.
- Stage 1 performance budgets are documented and the 50-finding report render check passes.
- Docker Compose starts the required local services.

## Stage 2 Gates

- All Stage 1 gates still pass.
- Rich source ingestion tests cover PPTX, CSV, XLSX, PNG, JPEG, WebP, audio, video and browser voice-note paths.
- Website ingestion tests cover scheme allow-listing, redirects, DNS/private-network blocking, size caps, timeout caps and reproducible snapshots.
- Code archive and repository tests cover path traversal, symlinks, nested archives, decompression limits, manifest generation, language summary, dependency/config index and file/line locators.
- External research tests cover explicit enablement, private research, query sanitisation, domain allow/block lists and separate external citations.
- Provider conformance tests cover expanded adapters, capability probes, fallback policy and policy-constrained diversity.
- Report tests cover the risk matrix, dependency relationships, time horizons, evidence quality, disagreements, strongest-case sections, pre-mortem, scenarios, validation experiments, action tracking, comparison and PDF export.
- Deterministic evaluation tests cover at least ten representative scenarios, adversarial fixtures and fake provider failure modes without live credentials.
- Visual and accessibility checks cover rich source states, research settings, report comparison, risk matrix and action tracking on desktop and mobile.
- Performance budgets exist for OCR, transcription, website ingestion, repository indexing, large reports and PDF export.
- README, threat model, ADRs and completion report document Stage 2 scope, limits, research modes, provider adapters and user-facing limitations.

## Stage 3 Gates

- All Stage 1 and Stage 2 gates still pass.
- Organisation workspace, invitation, member-management, project-permission, report-comment, action, decision-journal and notification tests pass.
- Provider and model governance tests prove disallowed provider routes are rejected before model calls.
- Report-sharing tests cover expiring links, access controls and share-access audit events.
- API-token tests prove tokens are scoped, revocable and never returned from list endpoints as plaintext.
- Webhook tests cover timestamped HMAC signing, invalid signatures and replay rejection.
- Custom-agent tests prove administrator-approved definitions cannot bypass tool, provider or schema policy.
- Retention, export and deletion request tests prove workflows are auditable and do not rewrite historical audit facts.
- Operations tests cover run inspector, operations summary, model comparison, scheduled re-review and outcome tracking.
- Visual and accessibility checks cover the Enterprise screen on desktop and mobile in dark and light themes.
- Production deployment checks include strict CSP, secure headers, CORS allow-lists, secure cookie settings, dependency scans, container scans and SBOM generation or documented local evidence.
- Administrator, security, operations, API and user guides document Stage 3 controls and limitations.

## Completion Report Template

- completed capabilities;
- incomplete release-blocking DoD items;
- security issues found and fixed;
- accepted security issues with owner and expiry;
- test results and coverage;
- accessibility, visual and performance results;
- migration or rollback notes;
- updated documentation;
- known limitations;
- next-stage readiness decision.
