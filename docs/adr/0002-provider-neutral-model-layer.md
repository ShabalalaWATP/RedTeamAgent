# ADR 0002: Provider-Neutral Model Layer

## Status

Accepted.

## Context

The product must not depend on one model provider SDK.

## Decision

Expose provider capabilities through small contracts, adapter schemas and a registry. Application routing consumes capabilities, not SDK objects.

## Consequences

- Real providers can be added without changing workflow code.
- Tests use a deterministic fake provider.
- Credentials stay server-side.
