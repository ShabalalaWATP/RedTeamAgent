# Release Gates

## Stage 1 Gates

- Backend unit coverage at or above 95 percent.
- Frontend unit coverage at or above 95 percent.
- TypeScript strict mode passes.
- Python type checking passes.
- Formatting and linting pass.
- Line-count check passes.
- Architecture-boundary tests pass.
- Security acceptance tests pass.
- End-to-end review workflow passes.
- WCAG 2.2 AA accessibility checks pass on auth, dashboard, new review, report, workflows and provider settings screens.
- Keyboard-only navigation reaches the core login, new review, source upload, run, report filter and provider settings controls.
- Visual regression baselines pass on auth, dashboard, new review, report, workflows and provider settings screens at desktop and mobile breakpoints in dark and light themes.
- Responsive checks pass at 360 px, 390 px, 768 px, 1024 px, 1440 px and 1920 px.
- Stage 1 performance budgets are documented and the 50-finding report render check passes.
- Docker Compose starts the required local services.

## Completion Report Template

- completed capabilities;
- incomplete release-blocking DoD items;
- security issues found and fixed;
- accepted security issues with owner and expiry;
- test results and coverage;
- accessibility, visual and performance results;
- migration or rollback notes;
- updated documentation;
- known limitations;
- next-stage readiness decision.
