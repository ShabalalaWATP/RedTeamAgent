from __future__ import annotations

from typing import Any

from app.application.ports.credentials import CredentialVault
from app.application.ports.mfa import MfaProvider
from app.domain.exceptions import AuthorisationError


class MfaService:
    def __init__(self, repo: Any, passwords: Any, vault: CredentialVault, mfa: MfaProvider, issuer: str) -> None:
        self.repo = repo
        self.passwords = passwords
        self.vault = vault
        self.mfa = mfa
        self.issuer = issuer

    def status(self, user_id: str) -> dict[str, bool]:
        setting = self.repo.get_mfa_setting(user_id)
        return {"enabled": bool(setting and setting.enabled)}

    def setup(self, user_id: str, email: str) -> dict[str, object]:
        existing = self.repo.get_mfa_setting(user_id)
        if existing is not None and existing.enabled:
            raise AuthorisationError("Multi-factor authentication is already enabled.")
        secret = self.mfa.generate_totp_secret()
        recovery_codes = self.mfa.generate_recovery_codes()
        sealed = self.vault.seal({"totp": secret})["totp"]
        hashes = [self.passwords.hash(code) for code in recovery_codes]
        self.repo.upsert_mfa_setting(user_id, sealed, hashes, enabled=False)
        self.repo.audit(None, user_id, "auth.mfa_setup_started", {})
        self.repo.commit()
        return {
            "enabled": False,
            "secret": secret,
            "provisioning_uri": self.mfa.provisioning_uri(secret, email, self.issuer),
            "recovery_codes": recovery_codes,
        }

    def enable(self, user_id: str, code: str) -> None:
        setting = self.repo.get_mfa_setting(user_id)
        if setting is None or not self._verify_totp(setting.secret_ciphertext, code):
            raise ValueError("Invalid multi-factor code.")
        self.repo.enable_mfa_setting(user_id)
        self.repo.audit(None, user_id, "auth.mfa_enabled", {})
        self.repo.commit()

    def disable(self, user_id: str, code: str) -> None:
        if not self.verify_login_code(user_id, code):
            raise ValueError("Invalid multi-factor code.")
        self.repo.disable_mfa_setting(user_id)
        self.repo.audit(None, user_id, "auth.mfa_disabled", {})
        self.repo.commit()

    def is_enabled(self, user_id: str) -> bool:
        setting = self.repo.get_mfa_setting(user_id)
        return bool(setting and setting.enabled)

    def verify_login_code(self, user_id: str, code: str | None) -> bool:
        if not code:
            return False
        setting = self.repo.get_mfa_setting(user_id)
        if setting is None or not setting.enabled:
            return True
        if self._verify_totp(setting.secret_ciphertext, code):
            return True
        return self._consume_recovery_code(user_id, code, setting.recovery_code_hashes)

    def _verify_totp(self, ciphertext: str, code: str) -> bool:
        secret = self.vault.unseal({"totp": ciphertext})["totp"]
        return self.mfa.verify_totp(secret, code)

    def _consume_recovery_code(self, user_id: str, code: str, hashes: list[str]) -> bool:
        remaining: list[str] = []
        matched = False
        for candidate_hash in hashes:
            if not matched and self.passwords.verify(candidate_hash, code):
                matched = True
            else:
                remaining.append(candidate_hash)
        if matched:
            self.repo.update_mfa_recovery_hashes(user_id, remaining)
        return matched
