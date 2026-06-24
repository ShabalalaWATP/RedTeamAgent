from __future__ import annotations

from typing import Any

from app.application.ports.providers import AdapterField, AdapterSchema, ProviderAdapter
from app.domain.policies import validate_provider_endpoint


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

    def generate_structured(self, prompt: str, schema_name: str) -> dict[str, Any]:
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


class StaticProviderAdapter:
    def __init__(self, schema: AdapterSchema, self_hosted_mode: bool = False) -> None:
        self.schema = schema
        self.self_hosted_mode = self_hosted_mode

    def test_connection(self, config: dict[str, Any], credentials: dict[str, str]) -> dict[str, Any]:
        if "endpoint_url" in config:
            validate_provider_endpoint(str(config["endpoint_url"]), self.self_hosted_mode)
        missing = [
            field.name
            for field in self.schema.fields
            if field.secret and field.required and not credentials.get(field.name)
        ]
        return {"ok": not missing, "missing": missing, "capabilities": self.schema.default_capabilities}

    def generate_structured(self, prompt: str, schema_name: str) -> dict[str, Any]:
        del prompt, schema_name
        raise RuntimeError("Live provider generation is disabled in Stage 1 local mode.")


class ProviderRegistry:
    def __init__(self, self_hosted_mode: bool = False) -> None:
        self._adapters: dict[str, ProviderAdapter] = {
            "fake": FakeProviderAdapter(),
            "openai": StaticProviderAdapter(
                AdapterSchema(
                    key="openai",
                    label="OpenAI",
                    fields=[AdapterField("api_key", "API key", secret=True, required=True, input_type="password")],
                    default_capabilities=["text", "structured_output", "streaming"],
                )
            ),
            "anthropic": StaticProviderAdapter(
                AdapterSchema(
                    key="anthropic",
                    label="Anthropic",
                    fields=[AdapterField("api_key", "API key", secret=True, required=True, input_type="password")],
                    default_capabilities=["text", "structured_output", "streaming"],
                )
            ),
            "google_gemini": StaticProviderAdapter(
                AdapterSchema(
                    key="google_gemini",
                    label="Google Gemini",
                    fields=[AdapterField("api_key", "API key", secret=True, required=True, input_type="password")],
                    default_capabilities=["text", "structured_output"],
                )
            ),
            "openai_compatible": StaticProviderAdapter(
                AdapterSchema(
                    key="openai_compatible",
                    label="Generic OpenAI-compatible",
                    fields=[
                        AdapterField("api_key", "API key", secret=True, required=True, input_type="password"),
                        AdapterField("endpoint_url", "Endpoint URL", secret=False, required=True, input_type="url"),
                    ],
                    default_capabilities=["text", "structured_output"],
                ),
                self_hosted_mode=self_hosted_mode,
            ),
        }

    def schemas(self) -> list[AdapterSchema]:
        return [adapter.schema for adapter in self._adapters.values()]

    def get(self, key: str) -> ProviderAdapter:
        return self._adapters[key]
