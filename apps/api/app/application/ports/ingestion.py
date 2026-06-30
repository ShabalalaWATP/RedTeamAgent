from __future__ import annotations

from typing import Any, Protocol


class ExternalSourceIngestor(Protocol):
    def website_snapshot(self, url: str, allow_domains: list[str], block_domains: list[str]) -> Any: ...
    def repository_snapshot(self, url: str) -> Any: ...


class AudioTranscriber(Protocol):
    def transcribe(
        self,
        *,
        provider: str,
        config: dict[str, Any],
        credentials: dict[str, str],
        filename: str,
        content_type: str,
        content: bytes,
    ) -> str | None: ...
