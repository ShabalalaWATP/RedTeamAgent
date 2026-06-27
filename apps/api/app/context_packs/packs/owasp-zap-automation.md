# OWASP ZAP Automation Framework

Use this pack only for authorised dynamic web-application testing.

## Review Rubric

- Confirm target ownership, scope, timing, rate limits and test account boundaries before any network scan.
- Prefer passive or baseline automation for routine checks.
- Keep active scan disabled unless the run has explicit authorisation, environment confirmation and rollback expectations.
- Record the target URL, scan profile, authentication state, excluded paths and evidence capture policy.
- Treat generated alerts as candidates requiring triage. Do not report them as confirmed vulnerabilities without validation.
- Store scan output as evidence but avoid logging session cookies, API keys or sensitive response bodies.

## Output Requirements

- Separate passive findings, active findings and manual validation notes.
- Include whether authenticated scanning was in scope.

## Authoritative Sources

- https://www.zaproxy.org/docs/automate/automation-framework/
