# RedTeamAgent

RedTeamAgent is a secure, provider-neutral decision-support platform for evidence-led red team reviews of decisions and artefacts of any kind: projects, proposals, essays, policies, code changes, operating plans and other choices. The current build is a Stage 1 foundation vertical slice: registration, workspace creation, projects, previous workflow history, reviews, source ingestion, agent context packs, provider routing, deterministic fake-provider review runs and evidence-linked reports.

The current implementation follows Stage 1 from `docs/codex-three-stage-goals.md`, but it is not yet a complete Stage 1 release. See `docs/delivery/stage-1-completion-report.md` for passed checks and remaining release-blocking gaps. Stage 2 and Stage 3 are intentionally out of scope until Stage 1 gates pass.

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

Provider connections are created from adapter schemas exposed by the API. Stage 1 includes:

- deterministic fake provider for local demos and tests;
- OpenAI text-generation adapter schema;
- Anthropic text-generation adapter schema;
- Google Gemini text-generation adapter schema;
- generic OpenAI-compatible adapter schema with endpoint validation.

Credentials are write-only. The API never returns stored provider credentials to the browser.

## Cheap Hosting Plan

Use `docs/deployment/cheap-hosting-plan.md` for a low-cost domain-backed deployment plan. The repository includes a production-oriented Docker Compose and Caddy setup under `deploy/cheap-vps/`.

## Known Limitations

- Local mode returns development verification and reset tokens; production mode should be configured with SMTP.
- Live provider calls are not required for Stage 1 checks. Real provider adapters currently validate configuration and capability metadata.
- Stage 1 supports text, Markdown, PDF and DOCX uploads only.
- Full Stage 1 release gates are not all implemented yet. Remaining gaps include live model catalogue sync, richer capability probes, true background workflow execution semantics, visual-regression baselines and complete WCAG audit coverage.
- Reports are decision-support artefacts, not legal, security, privacy, engineering or delivery sign-off.
