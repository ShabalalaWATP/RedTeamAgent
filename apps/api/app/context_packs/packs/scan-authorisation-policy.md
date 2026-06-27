# Controlled Scan Authorisation Policy

Use this pack before allowing dynamic scanning, browser probing or active vulnerability testing.

## Review Rubric

- Confirm that the requester owns or is authorised to test the target.
- Confirm that the target environment is production, staging, development or local.
- Passive checks may read public pages and responses within rate limits.
- Active scans, fuzzing, brute-force checks, destructive payloads and denial-of-service style tests require explicit per-run authorisation.
- Testing against third-party services, customer tenants or unknown assets is denied by default.
- Record scan time window, account used, target hostnames, exclusions and emergency stop contact.

## Output Requirements

- If authorisation is missing, recommend a safe plan instead of running tools.
- Never silently escalate from passive to active scanning.
