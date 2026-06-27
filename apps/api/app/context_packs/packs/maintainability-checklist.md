# Maintainability Checklist

Use this pack when reviewing code quality, delivery risk or long-term ownership.

## Review Rubric

- Check file size, responsibility boundaries and naming clarity.
- Check tests for behaviour, edge cases and security-sensitive paths.
- Check documentation for public interfaces, operational workflows and non-obvious decisions.
- Check error handling, logging and observability.
- Check that configuration is explicit and secrets are externalised.
- Check that code paths are simple enough for a future maintainer to audit.

## Output Requirements

- Prefer small, actionable refactors over broad rewrites.
- Note any issue that is a design choice rather than a bug.
