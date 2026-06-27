from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import sha256
from re import sub
from typing import Any, Protocol


class SearchProvider(Protocol):
    def search(self, query: str, allow_domains: list[str], block_domains: list[str]) -> list[dict[str, Any]]: ...


@dataclass(frozen=True)
class DeterministicSearchProvider:
    def search(self, query: str, allow_domains: list[str], block_domains: list[str]) -> list[dict[str, Any]]:
        domain = allow_domains[0] if allow_domains else "example.org"
        if domain in block_domains:
            return []
        accessed = datetime.now(UTC).date().isoformat()
        return [
            {
                "title": f"External source for {query}",
                "publisher": domain,
                "url": f"https://{domain}/research/{sha256(query.encode()).hexdigest()[:8]}",
                "publication_date": None,
                "accessed_at": accessed,
                "excerpt": f"Deterministic external research result related to {query}.",
                "quality_score": 0.72,
            }
        ]


def research_queries(title: str, focus_chips: list[str], private_mode: bool) -> list[str]:
    if private_mode:
        return ["decision risk validation", "comparable implementation evidence"]
    raw = " ".join([title, *focus_chips])
    raw = sub(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", " ", raw)
    cleaned = sub(r"[^a-zA-Z0-9 _-]", " ", raw)
    return [" ".join(cleaned.split())[:120] or "decision risk validation"]
