# RedTeamAgent

RedTeamAgent is a secure, provider-neutral decision-support platform for evidence-led red team reviews of decisions and artefacts of any kind: projects, proposals, essays, policies, code changes, operating plans and other choices. The current build completes the Stage 3 enterprise and production-readiness milestone: registration, workspace creation, projects, previous workflow history, rich evidence ingestion, external research controls, full specialist routing, provider governance, organisation administration, collaboration, expiring report shares, API/webhook integration, scheduled re-review, retention controls and operational dashboards.

The current implementation follows Stage 3 from `docs/codex-three-stage-goals.md`. See `docs/delivery/stage-3-completion-report.md` for passed checks, residual risks and the current readiness decision.

## Local Setup

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r apps\api\requirements-dev.txt
npm install --prefix apps/web
docker compose up -d postgres redis minio
```

Create `.env` from `.env.example` for local overrides. The backend starts without live provider credentials when `ALLOW_FAKE_PROVIDER=true`.

The dependency-only compose services use non-default host ports to avoid clashing with local database installs: PostgreSQL `55432`, Redis `56379`, MinIO API `59000` and MinIO console `59001`. Override `POSTGRES_HOST_PORT`, `REDIS_HOST_PORT`, `MINIO_API_HOST_PORT`, `MINIO_CONSOLE_HOST_PORT`, `API_HOST_PORT` or `WEB_HOST_PORT` before running `docker compose` if needed. When running the API outside Docker, point local `.env` values at those host ports.

## Development

```powershell
.\.venv\Scripts\python -m uvicorn app.main:app --reload --app-dir apps/api
npm run dev --prefix apps/web
```

Open the web app at `http://localhost:5173`. The API runs at `http://localhost:8000`.

## First Signup

1. Open `/auth`.
2. Enter an email address and a password of at least 12 characters.
3. Select `Register`.
4. In local mode, paste the returned verification token into `Verification token` and select `Verify email`. In production, use the emailed verification link.
5. Select `Log in`, then create a project and start a review.

Password reset uses the same `/auth` page: select `Send reset`, then use the emailed reset link or local reset token with `New password` and `Confirm reset`.

## Testing And Quality Gates

```powershell
.\.venv\Scripts\python -m pytest apps\api
.\.venv\Scripts\python -m mypy apps\api\app
.\.venv\Scripts\python -m ruff check apps\api
npm run typecheck --prefix apps/web
npm run test:coverage --prefix apps/web
npm run build --prefix apps/web
npm audit --prefix apps/web --audit-level=high
python scripts/check_line_lengths.py
python scripts/secret_scan.py
docker compose config
docker compose up -d --build
docker compose down
```

Backend and frontend coverage are measured separately and configured to fail below 95 percent.

If the default API or web ports are already in use, run the full stack with explicit host ports:

```powershell
$env:API_HOST_PORT='18000'
$env:WEB_HOST_PORT='15173'
docker compose up -d --build
```

Playwright E2E checks can be run with:

```powershell
npm run e2e --prefix apps/web
```

If Playwright browser installation is unavailable locally but Chromium already exists on the machine, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to the browser executable before running E2E.

## Provider Configuration

Provider connections are created from adapter schemas exposed by the API. Stage 2 includes:

- deterministic fake provider for local demos and tests;
- OpenAI text-generation adapter schema;
- Anthropic text-generation adapter schema;
- Google Gemini text-generation adapter schema;
- generic OpenAI-compatible adapter schema with endpoint validation;
- Azure OpenAI and Azure AI endpoint adapter schemas;
- Amazon Bedrock and Google Vertex AI adapter schemas;
- Ollama, vLLM and approved multi-provider gateway adapter schemas.

Credentials are encrypted server-side and write-only from the browser perspective. The API never returns stored provider credentials to the browser.
Saved provider connections can sync an adapter-backed model catalogue and probe saved model capabilities. Stage 2 capability records cover text generation, structured output, streaming, tool use, image input, embeddings, transcription and reranking where an adapter claims support.

Workspace governance can centrally restrict provider adapters, model identifiers, data classifications, regions, purposes and approved external research domains. Non-empty allow-lists fail closed before provider setup, model registration or review execution.

## Usage Controls

`USER_PROJECT_LIMIT`, `USER_WORKFLOW_TOTAL_LIMIT` and `USER_WORKFLOW_WEEKLY_LIMIT` define the standard account quotas. The default standard account can keep 5 projects, keep 20 workflows and start 10 workflows per week. `ADMIN_USAGE_MULTIPLIER` defaults to 3, so admin accounts receive triple the standard allowance. Owner accounts are unlimited. Deleting a project or workflow frees the stored quota, while weekly workflow starts are counted from audit history. Source ingestion and other expensive actions also keep the existing per-minute limiter.

## Admin Settings

The admin-only `Settings` view includes AI provider setup, model registration, agent model profiles, organisation settings, member management, invitations, provider governance, SSO/MFA-ready identity fields, SCIM mappings, data retention, audit inspection, action notifications, custom agents, rubrics, report templates, API tokens, webhooks, scheduled re-review, outcome tracking, operations summaries and model comparison. Regular members do not see the `Settings` nav item and admin endpoints reject non-admin access.

API tokens are returned once and then stored only as hashes. Webhook deliveries use timestamped HMAC signatures with replay protection. Report shares use expiring tokens and access events are audited.

## Stage 2 Inputs And Research

Reviews support pasted text plus TXT, Markdown, PDF, DOCX, PPTX, CSV, XLSX, PNG, JPEG, WebP, common audio, common video, ZIP and TAR uploads. Browser-recorded voice notes, public website URLs and public Git repository URLs can also be submitted as sources. Rich extraction records locators such as PDF pages, document paragraphs, slides, spreadsheet cells, OCR blocks, timestamps, website snapshots and code file line ranges.

The local deterministic extraction path records OCR and transcription quality warnings but does not claim human-grade recognition accuracy. Large-source limits are enforced for file size, extracted text length, page-like units, repository file count, website fetch size and request timeout.

External research is explicit per review. Private research mode avoids proprietary or sensitive source text in search queries. Domain allow and block lists constrain search-provider output, and external source records are cited separately from user-provided evidence with query, URL, access date, excerpt and quality score.

Advanced reports include a risk matrix that does not rely on colour alone, dependency relationships, time horizons, evidence quality, cross-agent disagreements, strongest case for and against, pre-mortem, plausible scenarios, validation experiments, action tracking, report comparison and PDF export.

## Cheap Hosting Plan

Use `docs/deployment/cheap-hosting-plan.md` for a low-cost domain-backed deployment plan. The repository includes a production-oriented Docker Compose and Caddy setup under `deploy/cheap-vps/`.

For `redteamagent.co.uk`, keep the GoDaddy domain registration if preferred and point DNS to the VPS:

- apex `A` record: `@` to the VPS IPv4 address;
- optional apex `AAAA` record: `@` to the VPS IPv6 address if the server is configured for IPv6;
- `www` record: `CNAME` to `redteamagent.co.uk` or an `A` record to the same VPS IPv4;
- Caddy hostnames: `redteamagent.co.uk,www.redteamagent.co.uk`;
- app URLs: `PUBLIC_APP_URL=https://redteamagent.co.uk` and `CORS_ORIGINS=https://redteamagent.co.uk,https://www.redteamagent.co.uk`.

## Known Limitations

- Local mode returns development verification and reset tokens; production mode should be configured with SMTP.
- Live provider credentials are optional. Real provider adapters support structured text-generation calls, but the local workflow defaults to the deterministic fake provider for repeatable tests and demos.
- OCR, transcription, website search and Git ingestion use deterministic local implementations for Stage 2 CI. Production-grade live connectors need provider credentials, monitoring and operational policy before real confidential workloads.
- Workflow execution uses FastAPI background tasks for the local slice. A Redis-backed external worker queue remains recommended before high-volume production use.
- Local SQLite development uses ordinary database audit storage. Production should forward structured audit events to append-only storage or immutable log retention as documented in the Stage 3 security guide.
- The WCAG result is a repository release gate, not a third-party certification.
- Reports are decision-support artefacts, not legal, medical, financial, security, privacy, engineering or delivery sign-off.
