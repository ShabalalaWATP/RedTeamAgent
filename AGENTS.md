# RedTeamAgent Project Instructions

Follow the global instructions first. These repository rules add project-specific constraints.

## Scope

- Implement the staged plan in `docs/codex-three-stage-goals.md`.
- Stage 3 is the current milestone. Keep every Stage 1 and Stage 2 gate passing while adding enterprise, governance and production-readiness capabilities.
- Do not weaken earlier-stage workflows, typed extension points, provider neutrality, tenant isolation or source trust boundaries while adding Stage 3 features.
- The product is defensive decision support. It must not claim professional sign-off, exhaustive coverage or autonomous exploitation.

## Architecture

- Backend code is a modular monolith under `apps/api/app`.
- Keep domain and application layers independent from FastAPI, SQLAlchemy ORM models, Celery and vendor SDKs.
- Keep provider, storage, search, ingestion, workflow and export behaviour behind small ports.
- Frontend code is feature-oriented under `apps/web/src/features`.
- No hand-written source file may exceed 400 physical lines, Markdown excluded.

## Security

- Treat uploaded sources, provider responses, websites, OCR text and model output as untrusted evidence.
- Enforce workspace membership and object-level authorisation in application code and tests.
- Authentication uses Argon2id password hashing and HttpOnly session cookies.
- Never return stored provider credentials to the browser.
- Provider endpoint validation must fail closed for private, loopback, link-local and cloud metadata addresses unless local self-hosted mode is explicitly enabled.

## Commands

- Backend install: `python -m venv .venv; .\.venv\Scripts\python -m pip install -r apps\api\requirements-dev.txt`
- Backend tests: `.\.venv\Scripts\python -m pytest apps\api`
- Backend type check: `.\.venv\Scripts\python -m mypy apps\api\app`
- Backend lint: `.\.venv\Scripts\python -m ruff check apps\api`
- Frontend install: `npm install --prefix apps/web`
- Frontend tests: `npm run test:coverage --prefix apps/web`
- Frontend type check: `npm run typecheck --prefix apps/web`
- Frontend build: `npm run build --prefix apps/web`
- Line limit: `python scripts/check_line_lengths.py`
