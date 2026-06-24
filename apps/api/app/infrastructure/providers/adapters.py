from __future__ import annotations

from typing import Any

from app.application.ports.providers import AdapterField, AdapterSchema, ProviderAdapter
from app.infrastructure.providers.live import (
    AnthropicProviderAdapter,
    GeminiProviderAdapter,
    OpenAICompatibleProviderAdapter,
    OpenAIProviderAdapter,
)


class FakeProviderAdapter:
    schema = AdapterSchema(
        key="fake",
        label="Deterministic fake provider",
        fields=[AdapterField("scenario", "Scenario", secret=False, required=False)],
        default_capabilities=["text", "structured_output", "streaming", "private_data"],
    )

    def test_connection(self, config: dict[str, Any], credentials: dict[str, str]) -> dict[str, Any]:
        del credentials
        scenario = str(config.get("scenario", "valid"))
        return {"ok": scenario not in {"timeout", "rate_limit"}, "scenario": scenario}

    def catalogue_models(self, config: dict[str, Any], credentials: dict[str, str]) -> list[dict[str, Any]]:
        del config, credentials
        return [
            {
                "model_identifier": "fake-reviewer",
                "capabilities": self.schema.default_capabilities,
                "provenance": "adapter_catalogue:fake",
                "verified": True,
                "probe_result": {"ok": True, "source": "deterministic_fake_catalogue"},
            }
        ]

    def probe_capabilities(self, model_identifier: str, capabilities: list[str]) -> dict[str, Any]:
        missing = [capability for capability in capabilities if capability == "missing_capability"]
        return {
            "ok": not missing,
            "model_identifier": model_identifier,
            "verified_capabilities": [capability for capability in capabilities if capability not in missing],
            "missing_capabilities": missing,
            "source": "deterministic_fake_probe",
        }

    def generate_structured(
        self,
        prompt: str,
        schema_name: str,
        config: dict[str, Any] | None = None,
        credentials: dict[str, str] | None = None,
        model_identifier: str | None = None,
    ) -> dict[str, Any]:
        del config, credentials, model_identifier
        if "invalid_schema" in prompt:
            return {"invalid": True}
        return {
            "schema": schema_name,
            "summary": "Deterministic review completed from supplied evidence.",
            "claims": [
                {
                    "title": "Evidence coverage needs active ownership.",
                    "severity": "medium",
                    "confidence": "high",
                    "category": "delivery",
                    "evidence": "source",
                }
            ],
        }


class ProviderRegistry:
    def __init__(self, self_hosted_mode: bool = False) -> None:
        self._adapters: dict[str, ProviderAdapter] = {
            "fake": FakeProviderAdapter(),
            "openai": OpenAIProviderAdapter(
                AdapterSchema(
                    key="openai",
                    label="OpenAI",
                    fields=[AdapterField("api_key", "API key", secret=True, required=True, input_type="password")],
                    default_capabilities=["text", "structured_output", "streaming"],
                ),
                [
                    {"model_identifier": "gpt-5.5"},
                    {"model_identifier": "gpt-5.4-mini"},
                ],
            ),
            "anthropic": AnthropicProviderAdapter(
                AdapterSchema(
                    key="anthropic",
                    label="Anthropic",
                    fields=[AdapterField("api_key", "API key", secret=True, required=True, input_type="password")],
                    default_capabilities=["text", "structured_output", "streaming"],
                ),
                [
                    {"model_identifier": "claude-opus-4-7"},
                    {"model_identifier": "claude-haiku-4-5"},
                ],
            ),
            "google_gemini": GeminiProviderAdapter(
                AdapterSchema(
                    key="google_gemini",
                    label="Google Gemini",
                    fields=[AdapterField("api_key", "API key", secret=True, required=True, input_type="password")],
                    default_capabilities=["text", "structured_output"],
                ),
                [
                    {"model_identifier": "gemini-3-pro-preview"},
                    {"model_identifier": "gemini-3-flash"},
                ],
            ),
            "openai_compatible": OpenAICompatibleProviderAdapter(
                AdapterSchema(
                    key="openai_compatible",
                    label="Generic OpenAI-compatible",
                    fields=[
                        AdapterField("api_key", "API key", secret=True, required=True, input_type="password"),
                        AdapterField("endpoint_url", "Endpoint URL", secret=False, required=True, input_type="url"),
                    ],
                    default_capabilities=["text", "structured_output"],
                ),
                [{"model_identifier": "configured-openai-compatible-model"}],
                self_hosted_mode=self_hosted_mode,
            ),
        }

    def schemas(self) -> list[AdapterSchema]:
        return [adapter.schema for adapter in self._adapters.values()]

    def get(self, key: str) -> ProviderAdapter:
        return self._adapters[key]
