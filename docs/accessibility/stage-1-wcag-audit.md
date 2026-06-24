# Stage 1 WCAG 2.2 AA Audit

Date: 24 June 2026

## Scope

This audit covers the Stage 1 core journeys and screens:

- registration, email verification and login;
- project dashboard;
- new review creation;
- pasted source ingestion and the upload control;
- context-pack creation;
- run/report viewing, timeline controls, report export and severity filters;
- previous workflow history;
- provider connection, model registration and agent-profile settings.

## Method

- Automated axe checks run in Playwright with the `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa` rule tags.
- The responsive audit matrix checks 360 px, 390 px, 768 px, 1024 px, 1440 px and 1920 px viewports.
- The matrix runs in both dark and light colour schemes.
- Every audited viewport checks for horizontal page overflow.
- The keyboard-only Playwright journey tabs through registration, verification, login, project creation, new review, source upload focus, context-pack creation, preflight, run start, report filter controls, workflow history and provider settings.
- Visual regression baselines are committed for auth, dashboard, new review, report, workflow history and provider settings in both dark and light themes on desktop and mobile Chromium projects.

## Result

Stage 1 passes the repository WCAG 2.2 AA gate for the scoped journeys. The final Playwright run passed with 7 tests and 1 intentional skip for the duplicate mobile execution of the explicit viewport matrix.

This is a repository release gate, not an external certification. A third-party manual audit with assistive-technology users should still be scheduled before a public production launch.
