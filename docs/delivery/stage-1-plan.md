# Stage 1 Implementation Plan

## Success Criteria

Stage 1 is complete only when the Stage 1 Definition of Done in `docs/codex-three-stage-goals.md` passes or incomplete items are listed as release-blocking.

## Work Items

1. Establish repository structure, docs, CI, Docker Compose and quality gates.
2. Implement backend domain policies, persistence, auth, workspace membership and object-level authorisation.
3. Implement source ingestion for pasted text, TXT, Markdown, PDF and DOCX.
4. Implement provider registry, deterministic test adapter, adapter schemas, capability records and routing policy.
5. Implement review workflow, durable events, SSE replay, cancellation and structured report generation.
6. Implement React/Vite app shell, auth, project/review creation, source upload, context-pack assignment, provider settings, run progress and report views.
7. Add backend, frontend, integration and e2e tests with separate 95 percent coverage gates.
8. Run architecture, line-count, secret scanning, accessibility, visual, performance and browser checks.

## Out Of Scope

Stage 2 and Stage 3 features remain out of scope until Stage 1 passes.
