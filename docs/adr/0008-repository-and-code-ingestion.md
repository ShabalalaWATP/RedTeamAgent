# ADR 0008: Repository And Code Ingestion

## Status

Accepted.

## Context

Decision reviews may need supporting code, configuration and dependency context, but uploaded or cloned code must not execute during ordinary review.

## Decision

ZIP, TAR and public Git sources are treated as inert evidence. Archive handling rejects path traversal, symlinks, nested archives, excessive expansion and malicious filenames. Code ingestion creates a manifest, language summary, dependency/config index and file-path plus line-range locators. No install scripts, package managers, tests, build tools or repository hooks are executed.

## Consequences

- Codebase reviews can reference specific files and line ranges.
- Secret-like values can be flagged or redacted before external processing.
- Any future sandbox execution path needs a separate approval and sandbox-control ADR.
