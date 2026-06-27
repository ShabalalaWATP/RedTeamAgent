# OWASP Top 10

Use this pack for broad web-application risk triage.

## Review Rubric

- Broken access control: check workspace isolation, ownership checks and admin privilege boundaries.
- Security misconfiguration: check debug mode, CORS, headers, default credentials and exposed admin surfaces.
- Software supply chain failures: check lockfiles, images, dependency review, build integrity and patching.
- Cryptographic failures: check transport security, storage of secrets and sensitive data exposure.
- Injection: check SQL, command, LDAP, template, prompt and deserialisation-style injection paths.
- Insecure design: check missing threat modelling, weak abuse controls and unsafe assumptions.
- Authentication failures: check password policy, sessions, MFA, recovery and enumeration.
- Software or data integrity failures: check unsigned updates, unsafe deserialisation and untrusted provider output.
- Security logging and alerting failures: check useful audit logs and alerting without secret leakage.
- Mishandling of exceptional conditions: check error handling, fail-safe behaviour and recovery paths.

## Output Requirements

- Link each issue to an abuse scenario and a practical mitigation.
- Do not treat Top 10 coverage as exhaustive.

## Authoritative Sources

- https://owasp.org/Top10/2025/
