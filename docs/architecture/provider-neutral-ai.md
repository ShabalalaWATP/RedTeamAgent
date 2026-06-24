# Provider-Neutral AI Layer

Stage 1 uses capability-specific contracts instead of provider SDKs in application code.

## Contracts

- `TextGenerationPort`: produces text or strict JSON-compatible structures.
- `CapabilityProbePort`: validates model capability metadata.
- `ModelCataloguePort`: lists adapter-backed model catalogue records for saved connections.
- `ProviderConnectionPort`: validates adapter configuration and write-only credentials.

Adapters are registered by name and expose configuration schemas that the frontend renders dynamically. The registry avoids central provider conditionals in workflow and routing logic.

## Stage 1 Adapters

- `fake`: deterministic local adapter for tests and demos.
- `openai`: native OpenAI text-generation schema.
- `anthropic`: native Anthropic text-generation schema.
- `google_gemini`: native Gemini text-generation schema.
- `openai_compatible`: generic endpoint-compatible schema with SSRF-aware endpoint validation.

Live credentials are optional for Stage 1. The fake provider is the default local route. Stage 1 catalogue sync uses adapter-maintained snapshots and durable probe records; direct live provider API sync should wait for a production credential-encryption strategy.
