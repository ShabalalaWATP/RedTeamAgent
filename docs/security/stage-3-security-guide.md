# Stage 3 Security Guide

Stage 3 adds organisation administration, provider governance, customisation and integrations. Treat these controls as security-sensitive configuration, not convenience settings.

The engineering baseline is documented in `docs/architecture/engineering-principles.md`. In short, security-critical behaviour is enforced by deterministic application code, not model prompts or frontend-only checks.

## Data Classification And Egress

Workspace governance can restrict providers, models, data classifications, regions and task purposes. A non-empty allow-list fails closed before provider setup, model registration or review execution.

## Tenant Isolation

Every enterprise resource belongs to a workspace, project, report, review or run that resolves to a workspace. Application services check membership, role and optional project-level permission before returning or mutating data.

## Integrations

API tokens are shown once, stored as hashes and can be revoked. Webhooks use timestamped HMAC signatures. Consumers must reject stale or replayed signatures.

Webhook endpoints must be public HTTPS URLs. Private, loopback, link-local, reserved and metadata-service targets are rejected before storage to avoid server-side request forgery paths when delivery is added.

## Public Readiness Gates

Production startup fails closed if critical public settings are unsafe: production must use HTTPS public URLs and CORS origins, secure cookies, PostgreSQL, SMTP mail delivery, CAPTCHA, a non-placeholder signing secret and no deterministic fake provider.

Public anonymous visit tracking is rate-limited by client identity. Side-effecting enterprise data-export requests use POST plus CSRF, not GET.

The hardened production profile also rejects token exposure, automatic owner bootstrap, missing Turnstile configuration and plain SMTP without STARTTLS.

## Secure By Design Controls

- Authentication uses Argon2id password hashing and server-side HttpOnly sessions.
- Password reset tokens include a password-hash fingerprint and become invalid after password change.
- Sensitive account state changes invalidate sessions.
- Owner creation is explicit through `SITE_OWNER_BOOTSTRAP_TOKEN`.
- Provider credentials are encrypted server-side and never returned to the browser.
- API tokens are shown once and stored only as hashes.
- Upload, archive and document parsing paths enforce size, path and expansion limits.
- Website ingestion pins the validated public IP during HTTPS fetches to reduce DNS rebinding risk.
- Provider endpoints are revalidated before outbound calls.
- Workspace and project authorisation checks happen in application services.
- Security-sensitive actions are audited.

## Incident Response

Rotate API tokens and webhook secrets immediately after suspected exposure. Review audit events for `provider.*`, `enterprise.*`, `report_share.*`, `data.*` and `webhook.*` actions. Treat any leaked provider credential as exposed and rotate it at the provider.
