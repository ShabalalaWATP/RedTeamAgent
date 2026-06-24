from __future__ import annotations

import hmac
from hashlib import sha256

from app.domain.exceptions import AuthorisationError, ValidationFailure


def sign_webhook_payload(secret: str, body: bytes, timestamp: int) -> str:
    payload = f"{timestamp}.".encode() + body
    return hmac.new(secret.encode("utf-8"), payload, sha256).hexdigest()


def verify_webhook_signature(
    secret: str,
    body: bytes,
    timestamp: int,
    signature: str,
    seen_signatures: set[str],
    now: int,
    tolerance_seconds: int = 300,
) -> None:
    if abs(now - timestamp) > tolerance_seconds:
        raise ValidationFailure("Webhook signature timestamp is outside the accepted tolerance.")
    if signature in seen_signatures:
        raise AuthorisationError("Webhook signature was already used.")
    expected = sign_webhook_payload(secret, body, timestamp)
    if not hmac.compare_digest(expected, signature):
        raise AuthorisationError("Webhook signature is invalid.")
