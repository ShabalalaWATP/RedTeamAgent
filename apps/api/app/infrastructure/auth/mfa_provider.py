from __future__ import annotations

from app.application.ports.mfa import MfaProvider
from app.infrastructure.auth import mfa


class BuiltInMfaProvider(MfaProvider):
    def generate_totp_secret(self) -> str:
        return mfa.generate_totp_secret()

    def generate_recovery_codes(self) -> list[str]:
        return mfa.generate_recovery_codes()

    def provisioning_uri(self, secret: str, email: str, issuer: str) -> str:
        return mfa.provisioning_uri(secret, email, issuer)

    def verify_totp(self, secret: str, code: str) -> bool:
        return mfa.verify_totp(secret, code)
