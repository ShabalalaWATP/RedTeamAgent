# Local Development Setup

This guide describes a repeatable local setup for Windows PowerShell. It keeps real secrets out of Git and uses deterministic local services unless you deliberately add live provider credentials.

## Prerequisites

- Windows PowerShell 7 or later.
- Python 3.13 or later. The project policy prefers newer supported Python versions when practical.
- Node.js 22 or later.
- Docker Desktop with the Linux engine running.
- Git.

## Clone And Install

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r apps\api\requirements-dev.txt
npm install --prefix apps/web
```

Start local infrastructure:

```powershell
docker compose up -d postgres redis minio
docker compose ps
```

The local Compose file maps dependency ports away from common defaults:

| Service | Container port | Local default |
|---|---:|---:|
| PostgreSQL | 5432 | 55432 |
| Redis | 6379 | 56379 |
| MinIO API | 9000 | 59000 |
| MinIO console | 9001 | 59001 |

Override the host ports only when your machine needs different values:

```powershell
$env:POSTGRES_HOST_PORT = "15432"
$env:REDIS_HOST_PORT = "16379"
$env:MINIO_API_HOST_PORT = "19000"
$env:MINIO_CONSOLE_HOST_PORT = "19001"
docker compose up -d postgres redis minio
```

## Local Environment Files

Git tracks examples and ignores real environment files:

| File | Git status | Purpose |
|---|---|---|
| `.env.example` | tracked | Local development variable names and safe defaults. |
| `.env` | ignored | Optional local API overrides. |
| `deploy/cheap-vps/.env.production.example` | tracked | Production variable names with blank secrets. |
| `deploy/cheap-vps/.env.production` | ignored | Local copy of production values, useful for deploy parity. |

For ordinary local development, create `.env` only if you need to override defaults:

```powershell
Copy-Item .env.example .env
notepad .env
```

When running the API outside Docker, point local dependencies at the mapped host ports:

```env
DATABASE_URL=postgresql+psycopg://redteam:redteam@localhost:55432/redteam
REDIS_URL=redis://localhost:56379/0
S3_ENDPOINT_URL=http://localhost:59000
```

Do not commit `.env` or `deploy/cheap-vps/.env.production`.

## Run The App

Terminal 1:

```powershell
.\.venv\Scripts\python -m uvicorn app.main:app --reload --app-dir apps/api
```

Terminal 2:

```powershell
npm run dev --prefix apps/web
```

Open:

- Web app: `http://localhost:5173`
- API health: `http://localhost:8000/health`
- API docs: `http://localhost:8000/docs`
- MinIO console: `http://localhost:59001`

## Local Signup

1. Open `http://localhost:5173/auth`.
2. Register with an email address and a password that is 12 to 128 characters and includes uppercase, lowercase, a number and a symbol.
3. Local development can expose verification/reset tokens when the local test settings opt into it. Production must not expose those tokens.
4. Verify the account, log in, create a project and create a review.

The deterministic test adapter is available only when `ALLOW_FAKE_PROVIDER=true` for automated or local testing. Production must set `ALLOW_FAKE_PROVIDER=false`.

## Local Production-Env Mirror

If you want your local machine to mirror the VPS production variables without committing secrets:

```powershell
$envFile = "deploy\cheap-vps\.env.production"
$example = "deploy\cheap-vps\.env.production.example"

if (!(Test-Path $envFile)) {
  Copy-Item $example $envFile
}

notepad $envFile
```

Set the real local values for:

```env
TURNSTILE_SECRET_KEY=
VITE_TURNSTILE_SITE_KEY=
SITE_OWNER_BOOTSTRAP_TOKEN=
SMTP_PASSWORD=
APP_SECRET_KEY=
POSTGRES_PASSWORD=
S3_SECRET_ACCESS_KEY=
MINIO_ROOT_PASSWORD=
```

Generate random 32-byte values with:

```powershell
$bytes = [byte[]]::new(32)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToHexString($bytes).ToLower()
```

## Quality Gates

Run these before pushing non-trivial changes:

```powershell
.\.venv\Scripts\python -m pytest apps\api
.\.venv\Scripts\python -m mypy apps\api\app
.\.venv\Scripts\python -m ruff check apps\api scripts
npm run typecheck --prefix apps/web
npm run test:coverage --prefix apps/web
npm run build --prefix apps/web
python scripts\check_line_lengths.py
python scripts\secret_scan.py
```

Security checks:

```powershell
.\.venv\Scripts\python -m bandit -q -r apps\api\app
.\.venv\Scripts\python -m pip_audit -r apps\api\requirements.txt
.\.venv\Scripts\python -m pip_audit -r apps\api\requirements-dev.txt
npm audit --prefix apps/web --audit-level=moderate
```

Compose checks:

```powershell
docker compose config
$env:APP_ENV_FILE = ".env.production.example"
docker compose --env-file deploy\cheap-vps\.env.production.example -f deploy\cheap-vps\docker-compose.prod.yml config
Remove-Item Env:APP_ENV_FILE
```

## Common Local Problems

| Symptom | Likely cause | Fix |
|---|---|---|
| API cannot connect to PostgreSQL | API is outside Docker but `DATABASE_URL` points at `postgres` | Use `localhost:55432` in `.env`. |
| Docker commands fail on Windows | Docker Desktop Linux engine is not running | Start Docker Desktop and wait for the engine. |
| Login cookie does not stick locally | `COOKIE_SECURE=true` on HTTP localhost | Use `COOKIE_SECURE=false` locally. |
| Production env validation fails locally | Using example placeholders as real secrets | Fill ignored `.env.production` with real values. |
| Fake provider appears in production | `ALLOW_FAKE_PROVIDER=true` | Production must set it to `false`. |
