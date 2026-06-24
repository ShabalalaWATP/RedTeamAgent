from __future__ import annotations

from typing import Protocol


class ObjectStoragePort(Protocol):
    def put(self, key: str, content: bytes, content_type: str) -> None: ...
    def get(self, key: str) -> bytes: ...
