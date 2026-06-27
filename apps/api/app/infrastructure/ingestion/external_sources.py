from __future__ import annotations

from typing import Any

from app.application.ports.ingestion import ExternalSourceIngestor
from app.infrastructure.ingestion import web_sources


class SafeExternalSourceIngestor(ExternalSourceIngestor):
    def website_snapshot(self, url: str, allow_domains: list[str], block_domains: list[str]) -> Any:
        return web_sources.website_snapshot(url, allow_domains, block_domains)

    def repository_snapshot(self, url: str) -> Any:
        return web_sources.repository_snapshot(url)
