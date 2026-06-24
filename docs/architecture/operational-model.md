# Stage 3 Operational Model

## Runtime Topology

The cheap production target remains one small VPS running the API, worker, web container, PostgreSQL, Redis, MinIO-compatible storage and Caddy TLS reverse proxy. A managed Postgres or object-storage provider can replace local services when usage grows.

## Production Controls

- Caddy terminates TLS for `redteamagent.co.uk` and redirects HTTP to HTTPS.
- The API uses restrictive CORS, HttpOnly cookies, CSRF checks and rate limits.
- Static web assets are built reproducibly from the locked frontend dependency graph.
- Database migrations run before the API and worker are restarted.
- Secrets are supplied by environment variables or a host secret manager, never by committed files.
- Dependency, container, secret and SBOM scans run in CI before release.

## Observability

Operational dashboards track run volume, failure rate, latency, source ingestion failures, queue depth, provider health, cost estimates, report quality failures and security events. Tracing and logs must redact source text, prompt content, provider credentials, session identifiers, API tokens and webhook secrets by default.

## Backup, Restore and DR

Backups cover PostgreSQL, object storage and deployment configuration. The initial recovery objectives are RTO 4 hours and RPO 24 hours. Restore drills should run against a staging VPS before production release. Rollback keeps the previous container image and database migration rollback notes for each release.
