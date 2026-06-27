# NCSC Secure Development and Deployment

Use this pack for engineering reviews, secure coding reviews, release readiness and defensive software lifecycle checks.

## Review Rubric

- Check whether design and implementation choices minimise attack surface.
- Check that secrets, credentials and signing keys are never committed, logged or returned to clients.
- Check that dependencies are pinned, reviewed and updated through a repeatable process.
- Require environment separation for development, staging and production.
- Require secure configuration defaults for authentication, session management, transport security and CORS.
- Confirm that build and deployment pipelines run linting, tests, dependency checks and secret checks.
- Confirm that audit logs capture security-relevant events without storing secrets or excess personal data.
- Confirm that incident response and vulnerability disclosure routes are documented.

## Agent Guidance

- Prefer concrete control evidence over generic statements that security was considered.
- Flag missing operational ownership as a security risk when no team can patch or respond quickly.

## Authoritative Sources

- https://www.ncsc.gov.uk/collection/developers-collection
