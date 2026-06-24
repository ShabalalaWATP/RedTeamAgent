from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class AdapterField:
    name: str
    label: str
    secret: bool
    required: bool
    input_type: str = "text"


@dataclass(frozen=True)
class AdapterSchema:
    key: str
    label: str
    fields: list[AdapterField]
    default_capabilities: list[str]


class ProviderAdapter(Protocol):
    schema: AdapterSchema

    def test_connection(self, config: dict[str, Any], credentials: dict[str, str]) -> dict[str, Any]: ...
    def catalogue_models(self, config: dict[str, Any], credentials: dict[str, str]) -> list[dict[str, Any]]: ...
    def probe_capabilities(self, model_identifier: str, capabilities: list[str]) -> dict[str, Any]: ...
    def generate_structured(
        self,
        prompt: str,
        schema_name: str,
        config: dict[str, Any] | None = None,
        credentials: dict[str, str] | None = None,
        model_identifier: str | None = None,
    ) -> dict[str, Any]: ...


class EmbeddingProvider(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...


class TranscriptionProvider(Protocol):
    def transcribe(self, media: bytes, content_type: str) -> list[dict[str, Any]]: ...


class RerankProvider(Protocol):
    def rerank(self, query: str, candidates: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]: ...
