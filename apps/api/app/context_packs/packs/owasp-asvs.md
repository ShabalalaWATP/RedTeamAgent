# OWASP Application Security Verification Standard

Use this pack for application security requirements, auth/session review and secure implementation checks.

## Review Rubric

- Map findings to ASVS control families where possible: architecture, authentication, session management, access control, validation, cryptography, errors, data protection, communications, malicious-code handling, business logic, files, API and configuration.
- Require object-level authorisation, not only route-level checks.
- Require parameterised database access and strict input validation at trust boundaries.
- Confirm that authentication uses proven password hashing, secure cookies and rate limiting.
- Confirm that sensitive errors do not reveal implementation details or secrets.
- Confirm that file upload handling checks extension, type, size, path safety and post-upload processing.
- Confirm that API responses never return credentials, tokens, private keys or provider secrets.

## Output Requirements

- Use ASVS as a control lens, not a certification claim.
- State the evidence needed before calling a control satisfied.

## Authoritative Sources

- https://owasp.org/www-project-application-security-verification-standard/
