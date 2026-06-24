# Stage 2 Completion Report

Date: 24 June 2026

## Readiness Decision

Stage 2 is complete against the repository release gates in `docs/codex-three-stage-goals.md`.

This release remains defensive decision support. It is not legal, medical, financial, security, privacy, engineering or delivery sign-off.

## Completed Capabilities

- Rich source ingestion for PPTX, CSV, XLSX, PNG, JPEG, WebP, audio, video, browser voice notes, website URLs, ZIP/TAR code archives and public Git repository URLs.
- Deterministic OCR and transcription metadata with quality warnings for local tests and demos.
- Hardened website ingestion with URL policy, private-network blocking, caps and stored snapshot metadata.
- Code archive and repository ingestion without executing untrusted code, including manifests, language summaries, dependency/config indexes and file/line locators.
- Explicit per-review external research, private research mode, query sanitisation, domain allow/block lists and separately cited external source records.
- Full Stage 2 specialist registry and router records for inclusion, exclusion, diversity and fallback decisions.
- Run routing plans record an explicit retry policy that distinguishes transient retryable failures from permanent fail-closed failures.
- Expanded provider adapter schemas and capability probes for text, structured output, streaming, tool use, image input, embeddings, transcription and reranking.
- Advanced report sections: risk matrix, dependencies, time horizons, evidence quality, disagreements, strongest case for and against, pre-mortem, scenarios, validation experiments, action tracking, comparison and PDF export.
- Deterministic evaluation endpoint and fixtures for routing, citation, unsupported-claim, duplicate, contradiction and completeness metrics.
- Mobile and desktop frontend controls for source intake, research settings, evaluation, report comparison and advanced report review.

## Incomplete DoD Items

None for the Stage 2 repository release gates.

## Security Issues Found And Fixed

- Rich uploaded, fetched and generated content is treated as untrusted evidence.
- Website ingestion fails closed for private, loopback, link-local and metadata targets.
- Archive ingestion rejects traversal, symlinks, nested archives and excessive expansion.
- External research avoids sensitive source text unless explicit policy allows it.
- PDF export renders structured report data through sanitised content paths.
- Backend image findings for `python-multipart` and `starlette` were fixed by pinning
  `python-multipart==0.0.32`, `fastapi==0.138.0` and `starlette==1.3.1`.
- Web image findings in bundled npm dependencies were fixed by upgrading npm to
  `11.17.0`, replacing npm's bundled `undici` with `6.27.0`, and excluding local
  dependency folders from Docker build contexts.

## Accepted Security Risks

- Local deterministic OCR, transcription, research and provider paths are suitable for CI and demos, not production-grade recognition or live research quality. Owner: project maintainer. Expiry: before real confidential users.
- Workflow execution still uses the local background runner. Owner: project maintainer. Expiry: before high-concurrency production use.

## Test Results

- Backend tests: `.\.venv\Scripts\python -m pytest apps\api`, passed, 41 tests.
- Backend coverage: pytest-cov, 95.30 percent total coverage.
- Backend lint: `.\.venv\Scripts\python -m ruff check apps\api`, passed.
- Backend type check: `.\.venv\Scripts\python -m mypy apps\api\app`, passed.
- Frontend unit tests: `npm run test:coverage --prefix apps/web`, passed, 66 tests.
- Frontend coverage: Vitest v8, 97.64 percent statements, 95.14 percent branches, 99.24 percent functions, 100 percent lines.
- Frontend type check: `npm run typecheck --prefix apps/web`, passed.
- Frontend production build: `npm run build --prefix apps/web`, passed, 352.94 kB JavaScript and 6.23 kB CSS before gzip.
- Dependency gate: `npm audit --prefix apps/web --audit-level=high`, passed with 0 vulnerabilities reported.
- Container vulnerability scan: `trivy image --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed` passed for `redteamagent-stage2-api:latest`, `redteamagent-stage2-worker:latest` and `redteamagent-stage2-web:latest` with 0 high or critical findings.
- OpenAPI export: `.\.venv\Scripts\python apps\api\scripts\export_openapi.py`, passed.
- Generated frontend OpenAPI types: `npm run generate:api --prefix apps/web`, passed.
- Line-count gate: `python scripts\check_line_lengths.py`, passed.
- Secret scan: `python scripts\secret_scan.py`, passed.
- Docker Compose config: `docker compose config`, passed.
- Cheap VPS production Compose config: `docker compose --env-file deploy\cheap-vps\.env.production -f deploy\cheap-vps\docker-compose.prod.yml config`, passed using a temporary env file.
- Docker Compose image build and full runtime: `docker compose -p redteamagent-stage2 build api worker web`, hardened no-cache web rebuilds, then `docker compose -p redteamagent-stage2 up -d`, passed with isolated temporary volumes and explicit host-port overrides. API `/health`, web `/`, MinIO live health, API container `git --version`, web container npm `11.17.0` and bundled `undici` `6.27.0` checks passed. A Docker-backed Stage 2 workflow ingested `https://example.com` and `https://github.com/octocat/Hello-World.git`, selected 20 specialists, recorded 20 diversity routes, recorded fallback to `fake-local`, recorded 3 transient and 4 permanent retry-policy classes and produced a report with 2 external sources, 1 risk-matrix row and 1 action item. The temporary stack was removed with `docker compose -p redteamagent-stage2 down -v`.
- Playwright E2E, accessibility and visual regression: `npm run e2e --prefix apps/web`, passed, 7 tests with 1 intentional skip after setting `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to the local cached Chromium executable. Stage 2 visual baselines were updated with `npm run e2e --prefix apps/web -- --update-snapshots` and then verified with a normal run.

## Accessibility, Visual And Performance Results

- Axe accessibility checks passed for auth, dashboard, new review, report, workflow history and provider settings.
- The responsive matrix covered 360 px, 390 px, 768 px, 1024 px, 1440 px and 1920 px in dark and light colour schemes.
- Keyboard-only Playwright coverage reached registration, verification, login, project creation, review creation, source intake, context-pack creation, preflight, run start, report filter controls, workflow history and provider settings.
- Visual baselines cover auth, dashboard, new review, report, workflows and provider settings on desktop and mobile in dark and light themes.
- Stage 2 performance budgets are documented in `docs/delivery/performance-budgets.md`.

## Migration Or Rollback Notes

- SQLAlchemy metadata initialisation remains the local database setup path.
- A production migration strategy is still required before non-local deployments with real user data.
- Stage 2 adds structured source metadata and report fields that should be migrated carefully once persistent production data exists.

## Updated Documentation

- `README.md`
- `AGENTS.md`
- `docs/architecture/architecture-decision-summary.md`
- `docs/architecture/data-model.md`
- `docs/architecture/workflow-state-model.md`
- `docs/accessibility/stage-2-wcag-audit.md`
- `docs/threat-model/threat-model.md`
- `docs/adr/0007-website-ingestion.md`
- `docs/adr/0008-repository-and-code-ingestion.md`
- `docs/adr/0009-ocr-and-transcription-strategy.md`
- `docs/adr/0010-external-research.md`
- `docs/adr/0011-model-diversity-and-fallback.md`
- `docs/delivery/stage-2-plan.md`
- `docs/delivery/release-gates.md`
- `docs/delivery/performance-budgets.md`
- `docs/deployment/cheap-hosting-plan.md`

## Recommended Next Step

Start Stage 3 only after Alex confirms the next milestone.
