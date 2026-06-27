# CWE Top 25 Static Review Lens

Use this pack for static vulnerability research and code review.

## Review Rubric

- Prioritise weakness classes with high exploitability and common impact: injection, improper neutralisation, memory safety, path traversal, deserialisation, authentication, authorisation, race conditions and unsafe defaults.
- Trace untrusted input from source to sink before claiming exploitability.
- Verify whether framework protections, type systems or parameterised APIs break the path.
- Check tests for negative cases, malformed input, permission failures and edge cases.
- For each candidate, state source, sink, sanitiser, privilege requirement and impact.

## Output Requirements

- Report candidate weaknesses separately from validated vulnerabilities.
- Prefer precise code references and reproducible reasoning over broad scanner labels.
