# ADR 0003: Workflow Engine Abstraction

## Status

Accepted.

## Context

Stage 1 needs durable progress and refresh-safe Server-Sent Events. Later stages may need a distributed queue.

## Decision

Use a workflow runner port with an initial local runner and Redis-compatible deployment shape.

## Consequences

- Tests remain deterministic.
- Docker Compose includes Redis and a worker service.
- Application code can migrate to Celery or another queue behind the same port.
