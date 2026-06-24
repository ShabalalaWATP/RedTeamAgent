# ADR 0007: Website Ingestion

## Status

Accepted.

## Context

Stage 2 needs public website evidence without turning URL ingestion into an SSRF, data exfiltration or reproducibility risk.

## Decision

Website ingestion is a bounded source-ingestor path with explicit scheme allow-listing, DNS revalidation, redirect revalidation, private-network blocking, timeout caps, size caps and reproducible snapshot metadata. The ingestor stores fetched text and snapshot locators as untrusted evidence. It does not crawl arbitrary site graphs by default.

## Consequences

- Reports can cite website evidence from a stored access-time snapshot.
- Private, loopback, link-local and cloud metadata targets fail closed.
- Broader crawling, authenticated browsing and JavaScript rendering remain future work.
