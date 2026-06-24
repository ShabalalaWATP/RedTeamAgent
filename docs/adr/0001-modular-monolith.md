# ADR 0001: Modular Monolith

## Status

Accepted.

## Context

Stage 1 needs strong boundaries without distributed-system overhead.

## Decision

Use a FastAPI modular monolith with domain, application, interface-adapter and infrastructure layers.

## Consequences

- Local development remains simple.
- Boundaries are enforced by tests and import rules.
- Future extraction to services remains possible where operational need appears.
