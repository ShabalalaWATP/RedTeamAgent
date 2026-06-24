# ADR 0010: External Research

## Status

Accepted.

## Context

External research can improve review quality, but it creates egress, confidentiality and citation-reproducibility risks.

## Decision

External research is explicit per review and uses a `SearchProvider` abstraction. Private research mode avoids proprietary or sensitive source text in queries. Query sanitisation, domain allow/block lists and quality ranking run before external source records are attached to reports. External evidence is cited separately from user-provided sources.

## Consequences

- Users can disable research for confidential reviews.
- High-sensitivity runs can expose the generated queries for review.
- Search-provider results are untrusted evidence and cannot override local source policy.
