from __future__ import annotations

from dataclasses import dataclass

TRANSIENT_FAILURES = {
    "provider_timeout": "Provider timeout or temporary network failure.",
    "provider_rate_limit": "Provider rate limit or temporary capacity failure.",
    "storage_retryable": "Temporary object storage or database availability failure.",
}

PERMANENT_FAILURES = {
    "schema_validation": "Provider output failed strict schema validation.",
    "quality_gate": "Report failed evidence or unsupported-claim quality gate.",
    "policy_denied": "Deterministic policy denied the requested route or action.",
    "unsupported_source": "Source type, size, name or content failed validation.",
}


@dataclass(frozen=True)
class RetryDecision:
    failure_code: str
    classification: str
    retryable: bool
    max_attempts: int
    reason: str


def classify_failure(failure_code: str) -> RetryDecision:
    if failure_code in TRANSIENT_FAILURES:
        return RetryDecision(failure_code, "transient", True, 3, TRANSIENT_FAILURES[failure_code])
    if failure_code in PERMANENT_FAILURES:
        return RetryDecision(failure_code, "permanent", False, 1, PERMANENT_FAILURES[failure_code])
    return RetryDecision(failure_code, "permanent", False, 1, "Unknown failures fail closed until classified.")


def retry_policy_snapshot() -> dict[str, object]:
    return {
        "transient": sorted(TRANSIENT_FAILURES),
        "permanent": sorted(PERMANENT_FAILURES),
        "default": classify_failure("unknown").__dict__,
    }
