# ADR 0006: Structured Report Data

## Status

Accepted.

## Context

Reports must be auditable, filterable and exportable without inventing citations.

## Decision

Store reports as structured JSON first, then render Markdown, JSON and printable HTML from the same data.

## Consequences

- Findings can be filtered by severity, confidence, agent and category.
- Quality gates can reject unsupported claims.
- Exporters do not need to parse prose.
