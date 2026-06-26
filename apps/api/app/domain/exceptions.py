from __future__ import annotations


class DomainError(Exception):
    status_code = 400
    code = "domain_error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class AuthenticationError(DomainError):
    status_code = 401
    code = "authentication_failed"


class MfaRequiredError(AuthenticationError):
    code = "mfa_required"


class AuthorisationError(DomainError):
    status_code = 403
    code = "authorisation_failed"


class NotFoundError(DomainError):
    status_code = 404
    code = "not_found"


class ConflictError(DomainError):
    status_code = 409
    code = "conflict"


class ValidationFailure(DomainError):
    status_code = 422
    code = "validation_failed"


class RateLimitExceeded(DomainError):
    status_code = 429
    code = "rate_limit_exceeded"


class ProviderPolicyError(DomainError):
    status_code = 422
    code = "provider_policy_failed"


class QualityGateError(DomainError):
    status_code = 422
    code = "quality_gate_failed"
