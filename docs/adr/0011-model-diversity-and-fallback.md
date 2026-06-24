# ADR 0011: Model Diversity And Fallback

## Status

Accepted.

## Context

Stage 2 in-depth reviews can benefit from model diversity, but routing must not bypass data classification, residency, provider pinning or local-only policies.

## Decision

Model diversity is policy-constrained and recorded in routing metadata. The router selects from the full specialist registry and saved model profiles, then records specialist inclusion, exclusion and fallback reasons. Fallbacks are visible in the report and cannot use providers or capabilities that violate the review policy.

## Consequences

- Diverse review paths are auditable instead of implicit.
- Local-only and pinned-provider reviews remain enforceable.
- Future organisation governance can build on the same routing records.
