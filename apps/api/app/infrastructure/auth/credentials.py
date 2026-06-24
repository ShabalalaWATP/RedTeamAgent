from __future__ import annotations

from base64 import urlsafe_b64encode

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


class FernetCredentialVault:
    def __init__(self, app_secret_key: str) -> None:
        self.fernet = Fernet(_derive_key(app_secret_key))

    def seal(self, credentials: dict[str, str]) -> dict[str, str]:
        return {
            key: self.fernet.encrypt(value.encode("utf-8")).decode("ascii")
            for key, value in credentials.items()
            if value
        }

    def unseal(self, sealed_credentials: dict[str, str]) -> dict[str, str]:
        try:
            return {
                key: self.fernet.decrypt(value.encode("ascii")).decode("utf-8")
                for key, value in sealed_credentials.items()
            }
        except InvalidToken as exc:
            raise ValueError("Stored provider credentials could not be decrypted.") from exc


def _derive_key(app_secret_key: str) -> bytes:
    derived = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"redteamagent-provider-credentials-v1",
        info=b"provider-credential-vault",
    ).derive(app_secret_key.encode("utf-8"))
    return urlsafe_b64encode(derived)
