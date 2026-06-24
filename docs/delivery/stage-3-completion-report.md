# Stage 3 Completion Report

Date: 24 June 2026

## Completed Capabilities

- Organisation workspaces, invitations, member lists and project-level permissions.
- Enterprise collaboration: report comments, action owners/status, decision journal, notifications and expiring report shares.
- SSO/MFA-ready governance fields and SCIM-ready mapping interfaces.
- Central provider/model governance with deterministic allow-list enforcement in provider setup, model registration and review routing.
- Data retention, export/deletion request records, audit inspector, run inspector, operations summary and model comparison.
- Administrator-approved custom agents, custom rubrics and report templates.
- API tokens, webhook registration, HMAC signing, replay protection, scheduled re-review and outcome tracking.
- Enterprise UI for organisation settings, members, provider governance, retention, audit, action tracking, customisation, integrations, operations and model comparison.
- Production Caddy headers now include strict CSP and security headers for the cheap VPS plan.

## Test Results

- Backend: `.\.venv\Scripts\python -m pytest apps\api`, passed, 96.41 percent coverage.
- Backend lint: `.\.venv\Scripts\python -m ruff check apps\api`, passed.
- Backend type check: `.\.venv\Scripts\python -m mypy apps\api\app`, passed.
- Frontend type check: `npm run typecheck --prefix apps/web`, passed.
- Frontend unit coverage: `npm run test:coverage --prefix apps/web`, passed, 97.9 percent statements and 95.52 percent branches.
- Frontend build: `npm run build --prefix apps/web`, passed, 367.05 kB JS and 7.41 kB CSS before gzip.
- Playwright browser verification: `npm run e2e --prefix apps/web -- --update-snapshots` and `npm run e2e --prefix apps/web`, passed, 7 tests passed and 1 mobile audit-matrix duplicate was skipped by design. Enterprise desktop and mobile snapshots were added.
- OpenAPI export and frontend type generation: `.\.venv\Scripts\python apps\api\scripts\export_openapi.py` and `npm run generate:api --prefix apps/web`, passed.
- Structure/security: `python scripts/check_line_lengths.py`, `python scripts/secret_scan.py` and `docker compose config`, passed.
- Cheap VPS production Compose config: `APP_ENV_FILE=.env.production.example docker compose --env-file .env.production.example -f docker-compose.prod.yml config`, passed.
- Docker runtime: `docker compose -p redteamagent-stage3 up -d --build` with isolated host ports, passed, API, web, worker, Postgres, Redis and MinIO started successfully.
- Dependency/security: `npm audit --prefix apps/web --audit-level=high`, passed with zero vulnerabilities.
- Trivy filesystem scan: `trivy fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL --exit-code 1 --ignore-unfixed --no-progress .`, passed with zero high or critical findings.
- Trivy image scans: `redteamagent-stage3-api:latest`, `redteamagent-stage3-worker:latest` and `redteamagent-stage3-web:latest`, passed with zero high or critical findings.
- SBOM validation: `trivy fs --scanners vuln --format cyclonedx --output $env:TEMP\redteamagent-trivy-sbom.cdx.json --no-progress .`, passed.

## Security Result

Security tests cover invitation abuse, project-level access, provider-governance data residency, expiring report shares, webhook replay, API-token plaintext exposure, custom-agent prompt injection and retention enforcement. Audit metadata is redacted in the enterprise repository adapter. Local audit tamper-evidence uses a documented compensating control; production deployments must forward audit events to append-only storage.

## Documentation Updated

- Architecture decision summary, data model, workflow state model, operational model and threat model.
- Administrator, security, operations, API and user guides.
- README, release gates, performance budgets and cheap hosting plan.

## Remaining Risks

- SSO and SCIM are represented by stable interfaces and data models, but no live identity-provider connector is enabled yet.
- The local background task runner is suitable for the staged release gate, but a dedicated queue worker is recommended for high-volume production.
- Production append-only audit storage and restore drills must be configured on the chosen VPS/provider before onboarding real users.
