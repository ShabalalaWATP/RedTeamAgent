# ADR 0004: Source Ingestion And Evidence Model

## Status

Accepted.

## Context

Reports must be evidence-linked and reproducible.

## Decision

Store source originals in object storage and extracted text as structured chunks with locators, metadata and warnings.

## Consequences

- Failed extraction is visible.
- Reports can cite source locators.
- Additional ingestors can be registered behind the same contract.
