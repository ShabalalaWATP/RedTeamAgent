# Stage 3 Operations Guide

## Deployment

Use `deploy/cheap-vps/docker-compose.prod.yml` behind Caddy for the initial low-cost deployment. Point the GoDaddy DNS `A` record for `redteamagent.co.uk` to the VPS public IP and let Caddy obtain TLS certificates.

The detailed command-level runbook is `docs/deployment/vps-domain-production.md`. Use that guide for first deployment, Turnstile setup, environment variables, firewall rules, health checks and update commands.

Production configuration lives in the ignored file `/opt/RedTeamAgent/deploy/cheap-vps/.env.production`. GitHub tracks only `deploy/cheap-vps/.env.production.example`, with secret values blank.

Before deploying a new commit:

```bash
cd /opt/RedTeamAgent
git fetch origin main
git pull --ff-only origin main
cd deploy/cheap-vps
APP_ENV_FILE=.env.production docker compose --env-file .env.production -f docker-compose.prod.yml config >/tmp/rta-compose-config.txt
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm --no-deps api python -c "from app.core.config import get_settings, validate_production_settings; validate_production_settings(get_settings()); print('production settings valid')"
```

Deploy:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build api worker web
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --force-recreate api worker web caddy
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

## Monitoring

Track API health, worker progress, queue depth, run failure rate, provider failures, report quality failures, webhook failures and security audit events. Logs and traces must redact source content, prompts, credentials, sessions, API tokens and webhook secrets.

Minimum checks:

```powershell
curl.exe -I http://redteamagent.co.uk/
curl.exe -I https://redteamagent.co.uk/auth
curl.exe -fsS https://redteamagent.co.uk/api/health
```

On the VPS:

```bash
cd /opt/RedTeamAgent/deploy/cheap-vps
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=120 api worker web caddy
```

Alert-worthy conditions:

- API, web or worker container is unhealthy.
- `/api/health` fails.
- Caddy cannot renew certificates.
- SMTP delivery fails.
- Turnstile verification failures spike.
- Login, registration or password-reset rate limits are repeatedly hit.
- Provider request failures spike.
- Audit logs show unexpected site-admin or provider-governance changes.

## Backup And Restore

Back up PostgreSQL, object storage and deployment environment files daily. Test restore into staging before a production launch. Record the restore timestamp and checksum in the release notes.

Backup scope:

- PostgreSQL database.
- MinIO object storage.
- `/opt/RedTeamAgent/deploy/cheap-vps/.env.production`.
- Caddy data volume, so certificate recovery is faster.

Before relying on backups, perform a restore drill into a staging VPS and verify login, project listing, source retrieval and report retrieval.

## Rollback

Keep the previous image tag and database rollback notes for each release. Roll back code before data when a migration is backward-compatible. Stop and take a database snapshot before any destructive migration.

Rollback procedure:

```bash
cd /opt/RedTeamAgent
git log --oneline -5
git checkout <known-good-commit>
cd deploy/cheap-vps
docker compose --env-file .env.production -f docker-compose.prod.yml build api worker web
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --force-recreate api worker web caddy
```

After rollback, verify `/api/health`, `/auth`, recent logs and a known user workflow. Do not roll back database state unless the release notes explicitly document a safe migration rollback.
