from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher, Type
from argon2.exceptions import VerifyMismatchError
from itsdangerous import BadSignature, URLSafeTimedSerializer


class PasswordService:
    def __init__(self) -> None:
        self._hasher = PasswordHasher(type=Type.ID)

    def hash(self, password: str) -> str:
        return self._hasher.hash(password)

    def verify(self, password_hash: str, password: str) -> bool:
        try:
            return self._hasher.verify(password_hash, password)
        except VerifyMismatchError:
            return False


class TokenService:
    def __init__(self, secret_key: str) -> None:
        self._serializer = URLSafeTimedSerializer(secret_key=secret_key)

    def sign(self, purpose: str, value: str) -> str:
        return self._serializer.dumps({"purpose": purpose, "value": value})

    def verify(self, purpose: str, token: str, max_age_seconds: int) -> str:
        try:
            payload = self._serializer.loads(token, max_age=max_age_seconds)
        except BadSignature as exc:
            raise ValueError("Invalid token.") from exc
        if payload.get("purpose") != purpose or not isinstance(payload.get("value"), str):
            raise ValueError("Invalid token purpose.")
        return payload["value"]


def new_session_expiry() -> datetime:
    return datetime.now(UTC) + timedelta(hours=12)


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)
