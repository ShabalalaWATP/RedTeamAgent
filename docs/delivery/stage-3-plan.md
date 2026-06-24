# Stage 3 Implementation Plan

## Milestone

Deliver enterprise workspaces, governance, collaboration, extensibility, API/webhook integration, scheduled re-review and production-readiness controls while keeping Stage 1 and Stage 2 flows passing.

## Tasks

1. Update Stage 3 architecture, data model, workflow, threat model and operational model.
2. Add enterprise persistence models and a separate enterprise repository adapter.
3. Add central enterprise RBAC, project permission and provider governance application services.
4. Add versioned enterprise API endpoints for organisations, invitations, governance, identity, collaboration, actions, report shares, API tokens, webhooks, scheduled reviews, outcomes, audit and operations.
5. Enforce provider/model governance in existing provider and workflow services.
6. Add tests for enterprise happy paths, security abuse cases, retention, token hashing, webhook replay, data residency and scheduled jobs.
7. Add an Enterprise frontend screen covering organisation settings, members, provider governance, retention, audit, action tracking, customisation and model comparison.
8. Add frontend unit tests, Playwright accessibility checks and visual baselines for the enterprise screen.
9. Update administrator, security, operations, API and user documentation.
10. Run full backend, frontend, security, line-limit, OpenAPI, Docker and browser verification gates.

## Success Criteria

- Stage 1 and Stage 2 workflows still pass.
- Backend and frontend coverage remain at least 95 percent separately.
- No hand-written source file exceeds 400 lines.
- Provider governance rejects disallowed routes before model calls.
- Invitation, report-share, API-token, webhook, retention and custom-agent security tests pass.
- The enterprise UI is usable on desktop and mobile without horizontal overflow.
