# ADR 0005: Authentication And Session Model

## Status

Accepted.

## Context

The product handles sensitive tenant data and provider credentials.

## Decision

Use Argon2id password hashing, server-side sessions and HttpOnly cookies. Do not store bearer tokens in local storage.

## Consequences

- Browser JavaScript cannot read session identifiers.
- CSRF protection is required for cookie-authenticated mutations.
- Sessions can be revoked server-side.
