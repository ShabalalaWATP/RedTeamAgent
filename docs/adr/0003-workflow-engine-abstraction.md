# ADR 0003: Workflow Engine Abstraction

## Status

Accepted.

## Context

Stage 1 needs durable progress and refresh-safe Server-Sent Events. Later stages may need a distributed queue.

## Decision

Use a workflow runner port with an initial in-process background runner and Redis-compatible deployment shape.

## Consequences

- Tests remain deterministic.
- Docker Compose includes Redis and a worker service.
- Stage 1 API calls can return a queued run while background execution commits durable events.
- Application code can migrate to Celery or another queue behind the same port.
