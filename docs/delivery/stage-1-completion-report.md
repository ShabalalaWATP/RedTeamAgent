# Stage 1 Completion Report

Date: 24 June 2026

## Readiness Decision

Stage 1 is not complete.

The repository now has a working secure foundation and vertical slice, but several release-blocking Definition of Done items from `docs/codex-three-stage-goals.md` remain incomplete. Stage 2 and Stage 3 must not start until the items below are resolved and the full Stage 1 gate is rerun.

## Completed Capabilities

- FastAPI modular-monolith backend with domain, application, interface-adapter and infrastructure boundaries.
- React, TypeScript, Vite frontend with feature-oriented modules and generated OpenAPI client.
- Registration, email verification token, login, logout and password-reset request flow.
- Argon2id password hashing, HttpOnly session cookie and CSRF header checks.
- Personal workspace creation for registered users.
- Project creation, update, delete and project listing APIs plus frontend controls for authorised workspaces.
- Review creation with proposal text, mode and focus chips.
- Previous workflow history API and frontend screen for signed-in users.
- Text source creation plus TXT, Markdown, PDF and DOCX upload/extraction support.
- Context pack creation endpoint.
- Provider adapter schemas for fake, OpenAI, Anthropic, Google Gemini and generic OpenAI-compatible adapters.
- Provider credential submission is write-only from the browser perspective.
- Deterministic fake provider and provider endpoint validation for hosted mode.
- Local workflow progression through intake, ingestion, framing, agent planning, specialist review, reconciliation, report composition and quality gate.
- Structured evidence-linked report retrieval and Markdown, JSON and HTML export.
- Dark-mode-first responsive UI for auth, projects, provider settings, review creation and report screens.
- Docker Compose configuration for web, API, worker, PostgreSQL with pgvector image, Redis and MinIO.
- Cheap VPS deployment plan with production Compose, Caddy reverse proxy and domain guidance.

## Incomplete DoD Items

- Email verification and password reset are local-token development flows, not mail-provider-backed production flows.
- Context pack UI assignment to a specific agent is minimal and needs richer version/provenance display.
- Model catalogue sync, manual model registration, model profiles and agent-profile assignment are not complete.
- Capability probe UI and durable model capability records are not complete.
- Hybrid retrieval is represented by evidence models and extraction paths, but full PostgreSQL full-text plus pgvector retrieval is not production-complete.
- Server-Sent Events progress is covered by run events, but the browser currently polls event history rather than consuming a live SSE stream.
- Cancel and retry controls for safe stages are not complete.
- Full CRUD and IDOR coverage for every workspace-owned resource is not complete.
- Provider adapters beyond the deterministic fake provider are schema/configuration adapters, not live text-generation callers.
- Visual-regression baselines are screenshots, not an automated baseline suite.
- WCAG coverage includes an automated Playwright axe smoke check, not a complete WCAG 2.2 AA audit.
- Docker Compose was configuration-validated, but the full multi-service runtime was not brought up and exercised end to end.
- Branch coverage is below 95 percent on the frontend, although statements, functions and lines pass the 95 percent gate.

## Security Issues Found And Fixed

- Provider endpoint validation blocks loopback, private, link-local and cloud metadata routes in hosted mode unless self-hosted mode is explicitly enabled.
- Stored provider credentials are never returned by provider connection responses.
- Object-level workspace checks are covered for representative project, review, source, context pack, run and report paths.
- Prompt-injection-style source text is treated as untrusted evidence in tests and cannot override deterministic routing or report quality gates.
- The report footer was changed from a fixed overlay to normal document flow after visual verification showed it covering report content.
- Frontend dev-tooling advisories were resolved by pinning patched transitive dependencies for Vite/esbuild and OpenAPI YAML parsing.

## Accepted Security Risks

- Local development secrets in `.env.example` and Docker Compose are placeholders and must not be used outside local development. Owner: project maintainer. Expiry: before any shared environment.

## Test Results

- Backend tests: `.\.venv\Scripts\python -m pytest apps\api`, passed, 22 tests.
- Backend coverage: pytest-cov, 97.39 percent total coverage.
- Backend lint: `.\.venv\Scripts\python -m ruff check apps\api`, passed.
- Backend type check: `.\.venv\Scripts\python -m mypy apps\api\app`, passed.
- Frontend unit tests: `npm run test:coverage --prefix apps/web`, passed, 21 tests.
- Frontend coverage: Vitest v8, 95.30 percent statements, 83.80 percent branches, 98.46 percent functions, 99.66 percent lines.
- Frontend type check: `npm run typecheck --prefix apps/web`, passed.
- Frontend production build: `npm run build --prefix apps/web`, passed.
- Dependency gate: `npm audit --prefix apps/web --audit-level=high`, passed with 0 vulnerabilities reported.
- OpenAPI export: `..\..\.venv\Scripts\python scripts\export_openapi.py`, passed.
- Line-count gate: `python scripts\check_line_lengths.py`, passed.
- Secret scan: `python scripts\secret_scan.py`, passed.
- Docker Compose config: `docker compose config`, passed.
- Cheap VPS production Compose config: `docker compose --env-file deploy\cheap-vps\.env.production -f deploy\cheap-vps\docker-compose.prod.yml config`, passed using a temporary placeholder env file.
- Playwright E2E: `npm run e2e --prefix apps/web`, passed with desktop and mobile Chromium projects after setting `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to the local cached Chromium executable.
- In-app browser QA: passed on a real local API and Vite app for register, verify, login, project create/edit/delete, decision review run, workflow history, desktop viewport, mobile viewport and workflow history report navigation. A desktop clipping issue in workflow history and a mobile topbar overlay issue on the dashboard were found and fixed.

## Accessibility Results

- Playwright E2E includes an axe check for serious and critical violations on the auth screen.
- Keyboard-accessible buttons, fields and links are present for the implemented core screens.
- Complete WCAG 2.2 AA audit coverage for login, new review, running, report and provider settings remains incomplete.

## Visual Regression Results

- Screenshots captured:
  - `output/playwright/report-desktop.png`
  - `output/playwright/report-mobile.png`
- Manual inspection confirmed the report screen renders on desktop and mobile without the previous footer overlap.
- In-app browser screenshots confirmed the previous-workflows screen and project dashboard controls render on desktop and mobile without clipped actions after the responsive layout fixes.
- Automated visual baseline comparison is not implemented yet.

## Performance Results

- Frontend production bundle built successfully at approximately 322.73 kB JavaScript and 4.90 kB CSS before gzip.
- Formal app shell, interaction, run-progress and large-report performance budgets are documented as required work, not yet enforced.

## Migration Or Rollback Notes

- No database migration tool has been introduced yet.
- SQLAlchemy metadata initialisation is used for the local Stage 1 foundation.
- A production migration strategy must be added before non-local deployments.

## Updated Documentation

- `README.md`
- `AGENTS.md`
- `docs/product-spec.md`
- `docs/codex-three-stage-goals.md`
- `docs/architecture/architecture-decision-summary.md`
- `docs/architecture/data-model.md`
- `docs/architecture/workflow-state-model.md`
- `docs/architecture/provider-neutral-ai.md`
- `docs/architecture/retrieval-and-evidence.md`
- `docs/threat-model/threat-model.md`
- `docs/threat-model/trust-boundaries.mmd`
- `docs/threat-model/abuse-cases.md`
- `docs/threat-model/security-acceptance-tests.md`
- `docs/adr/0001-modular-monolith.md`
- `docs/adr/0002-provider-neutral-model-layer.md`
- `docs/adr/0003-workflow-engine-abstraction.md`
- `docs/adr/0004-source-ingestion-and-evidence-model.md`
- `docs/adr/0005-authentication-and-session-model.md`
- `docs/adr/0006-structured-report-data.md`
- `docs/delivery/stage-1-plan.md`
- `docs/delivery/release-gates.md`
- `docs/delivery/stage-1-completion-report.md`
- `docs/deployment/cheap-hosting-plan.md`
- `deploy/cheap-vps/docker-compose.prod.yml`
- `deploy/cheap-vps/Caddyfile`
- `deploy/cheap-vps/.env.production.example`
- `apps/web/Dockerfile.prod`
- `apps/web/nginx.conf`

## SOLID And Maintainability Checklist

- Pass for the implemented foundation.
- Route handlers remain thin and delegate to application services.
- Provider, storage, ingestion, workflow and export behaviour sit behind small ports or adapter seams.
- Domain and application layers do not import FastAPI, SQLAlchemy ORM models, Celery, React internals or vendor SDKs.
- Deliberate deviation: the initial workflow engine is local and synchronous for the Stage 1 vertical slice.

## File-Size And Anti-God-Object Review

- `python scripts/check_line_lengths.py` passed.
- Generated OpenAPI client and lockfiles are excluded from the hand-written source limit.
- No hand-written source file exceeds 400 physical lines.

## Secure-By-Design Acceptance Test Result

- Representative tests cover tenant isolation, object-level authorisation, upload handling, prompt-injection resistance, provider endpoint validation, schema failure and credential write-only behaviour.
- Full IDOR/resource matrix coverage remains incomplete and is release-blocking before Stage 1 can be called done.

## Recommended Next Step

Keep working on Stage 1. Do not start Stage 2. The next useful milestone is to finish model catalogue/profile flows, live SSE consumption, cancel/retry, stronger context-pack provenance and automated accessibility/visual baselines.
