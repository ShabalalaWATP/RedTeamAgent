from __future__ import annotations

from typing import Any, Protocol


class ExternalSourceIngestor(Protocol):
    def website_snapshot(self, url: str, allow_domains: list[str], block_domains: list[str]) -> Any: ...
    def repository_snapshot(self, url: str) -> Any: ...
