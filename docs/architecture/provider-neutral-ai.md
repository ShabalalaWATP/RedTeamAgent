# Provider-Neutral AI Layer

The AI layer is provider-neutral by design. Application and workflow code depend on capability contracts and adapter schemas, not vendor SDKs or hard-coded model names.

## Contracts

- `TextGenerationPort`: produces text or strict JSON-compatible structures.
- `CapabilityProbePort`: validates model capability metadata.
- `ModelCataloguePort`: lists adapter-backed model catalogue records for saved connections.
- `ProviderConnectionPort`: validates adapter configuration and write-only credentials.

Adapters are registered by name and expose configuration schemas that the frontend renders dynamically. The registry avoids central provider conditionals in workflow and routing logic.

## Available Adapters

- `fake`: deterministic local adapter for tests and demos. Production disables it.
- `openai`: OpenAI-compatible managed API with structured text-generation support.
- `anthropic`: Anthropic managed API with structured text-generation support.
- `google_gemini`: Google Gemini managed API with structured text-generation support.
- `openai_compatible`: generic OpenAI-compatible endpoint. Hosted mode restricts endpoint bases to an allow-list.
- `azure_openai`: Azure OpenAI schema and catalogue path.
- `azure_ai_endpoint`: Azure AI model endpoint schema.
- `amazon_bedrock`: Amazon Bedrock schema.
- `google_vertex_ai`: Google Vertex AI schema.
- `ollama`: self-hosted local model endpoint schema.
- `vllm`: self-hosted vLLM endpoint schema.
- `approved_gateway`: approved multi-provider gateway schema.

Live credentials are optional for local development. The fake provider is the default local route when `ALLOW_FAKE_PROVIDER=true`. Production must set `ALLOW_FAKE_PROVIDER=false`.

OpenAI, Anthropic, Google Gemini and OpenAI-compatible adapters can issue live structured text-generation calls when server-side encrypted credentials and a model identifier are supplied. The other provider schemas establish the governance, catalogue and capability shape used by the UI and policy layer, even where the current implementation still uses deterministic catalogue records.

## Model Records And Capabilities

Saved provider connections can sync or register model records. A model record captures:

- provider adapter;
- model identifier;
- capability snapshot;
- provenance;
- verification state;
- probe result.

Current capability labels include:

- `text`;
- `structured_output`;
- `streaming`;
- `tool_use`;
- `image_input`;
- `embeddings`;
- `transcription`;
- `rerank`;
- `private_data`.

The router checks capability and governance constraints before a model is used. Fallbacks cannot weaken data classification, residency policy, provider allow-lists or explicit model pinning.

## Example Catalogue Entries

Adapter-maintained catalogues include examples such as:

| Adapter | Example model identifiers |
|---|---|
| OpenAI | `gpt-5.5`, `gpt-5.4-mini` |
| Anthropic | `claude-opus-4-7`, `claude-haiku-4-5` |
| Google Gemini | `gemini-3-pro-preview`, `gemini-3-flash` |
| Azure OpenAI | `gpt-4.1-mini`, `gpt-4.1` |
| Generic OpenAI-compatible | `configured-openai-compatible-model` |
| Self-hosted or gateway adapters | `<adapter>-default` unless manually registered |

These identifiers are catalogue defaults, not a promise that a tenant has access to those models. Administrators must configure provider credentials and model records that match their real provider account.

## Provider Governance

Workspace governance can restrict:

- provider adapters;
- model identifiers;
- data classifications;
- regions;
- task purposes;
- approved external research domains.

Non-empty allow-lists fail closed. A disallowed provider connection, model registration or review run is rejected before a model call is attempted.

## Endpoint Safety

Hosted provider mode requires public HTTPS endpoints and blocks:

- loopback addresses;
- private network ranges;
- link-local addresses;
- reserved addresses;
- cloud metadata addresses;
- URLs containing embedded credentials.

Self-hosted private endpoints require explicit self-hosted mode. That mode is intended for controlled local or private deployments, not public hosted provider configuration.

Provider credentials are encrypted at rest with a Fernet vault derived from `APP_SECRET_KEY`, decrypted only server-side and never returned to the browser.
