# Stage 3 API Guide

Enterprise endpoints use authenticated cookie sessions plus CSRF for browser mutations. Integration tokens use scoped API tokens once an integration surface is enabled.

## Endpoint Groups

- `/enterprise/workspaces`: organisation workspace creation, members and governance.
- `/enterprise/invitations`: invitation acceptance.
- `/enterprise/projects`: project-level permissions.
- `/enterprise/reports`: comments, actions and expiring shares.
- `/enterprise/reviews`: decision journal entries.
- `/enterprise/integrations`: API tokens and webhooks.
- `/enterprise/scheduled-reviews`: periodic re-review.
- `/enterprise/audit`: audit inspector.

## Webhook Signing

Webhook deliveries include a Unix timestamp and an HMAC-SHA256 signature over `timestamp.body`. Consumers should reject timestamps outside the configured tolerance and any signature already seen for the same endpoint.
