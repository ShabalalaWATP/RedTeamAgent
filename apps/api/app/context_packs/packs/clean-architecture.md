# Clean Architecture Review Lens

Use this pack for maintainability and boundary review.

## Review Rubric

- Keep domain and application logic independent from frameworks and vendor SDKs.
- Keep route handlers thin and move business rules into services.
- Keep persistence and external systems behind ports or adapters.
- Keep side effects explicit and testable.
- Add abstractions only for real boundaries or repeated complexity.
- Avoid broad utility modules and hidden global state.

## Output Requirements

- Report architectural risk only when it affects change safety, testability, security or delivery.
- Prefer concrete module boundaries over abstract purity arguments.
