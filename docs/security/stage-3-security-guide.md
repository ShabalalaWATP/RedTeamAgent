# Stage 3 Security Guide

Stage 3 adds organisation administration, provider governance, customisation and integrations. Treat these controls as security-sensitive configuration, not convenience settings.

## Data Classification And Egress

Workspace governance can restrict providers, models, data classifications, regions and task purposes. A non-empty allow-list fails closed before provider setup, model registration or review execution.

## Tenant Isolation

Every enterprise resource belongs to a workspace, project, report, review or run that resolves to a workspace. Application services check membership, role and optional project-level permission before returning or mutating data.

## Integrations

API tokens are shown once, stored as hashes and can be revoked. Webhooks use timestamped HMAC signatures. Consumers must reject stale or replayed signatures.

## Incident Response

Rotate API tokens and webhook secrets immediately after suspected exposure. Review audit events for `provider.*`, `enterprise.*`, `report_share.*`, `data.*` and `webhook.*` actions. Treat any leaked provider credential as exposed and rotate it at the provider.
