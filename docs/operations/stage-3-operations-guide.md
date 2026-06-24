# Stage 3 Operations Guide

## Deployment

Use `deploy/cheap-vps/docker-compose.prod.yml` behind Caddy for the initial low-cost deployment. Point the GoDaddy DNS `A` record for `redteamagent.co.uk` to the VPS public IP and let Caddy obtain TLS certificates.

## Monitoring

Track API health, worker progress, queue depth, run failure rate, provider failures, report quality failures, webhook failures and security audit events. Logs and traces must redact source content, prompts, credentials, sessions, API tokens and webhook secrets.

## Backup And Restore

Back up PostgreSQL, object storage and deployment environment files daily. Test restore into staging before a production launch. Record the restore timestamp and checksum in the release notes.

## Rollback

Keep the previous image tag and database rollback notes for each release. Roll back code before data when a migration is backward-compatible. Stop and take a database snapshot before any destructive migration.
