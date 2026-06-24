# Stage 1 Security Acceptance Tests

The automated backend tests cover:

- cross-workspace access denial for projects, reviews, sources, context packs, runs and reports;
- IDOR checks for workspace-owned resources;
- file upload MIME spoofing, unsupported type, oversized file and malicious filename;
- prompt-injection text cannot override provider routing, tool permissions or quality gates;
- generic provider endpoint validation blocks private, loopback, link-local and metadata addresses in hosted mode;
- invalid structured provider output produces a bounded failure;
- provider credentials are not returned to the browser.
