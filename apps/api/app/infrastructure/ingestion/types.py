from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ExtractedChunk:
    locator: str
    text: str


@dataclass(frozen=True)
class ExtractionResult:
    chunks: list[ExtractedChunk]
    metadata: dict[str, object]
    warnings: list[str]
