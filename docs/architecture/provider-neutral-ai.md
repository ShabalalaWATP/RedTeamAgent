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

Live credentials are optional for Stage 1. The fake provider is the default local route. OpenAI, Anthropic, Google Gemini and OpenAI-compatible adapters can issue live structured text-generation calls when server-side encrypted credentials and a model identifier are supplied. Catalogue sync uses adapter-maintained snapshots by default and can opt into live provider catalogue calls with `live_catalogue` configuration.

Provider credentials are encrypted at rest with a Fernet vault derived from `APP_SECRET_KEY`, decrypted only server-side and never returned to the browser.
