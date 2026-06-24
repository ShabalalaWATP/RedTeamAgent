from __future__ import annotations

from typing import Protocol


class CredentialVault(Protocol):
    def seal(self, credentials: dict[str, str]) -> dict[str, str]: ...
    def unseal(self, sealed_credentials: dict[str, str]) -> dict[str, str]: ...
