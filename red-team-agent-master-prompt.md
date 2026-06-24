# Red Teaming Agent: Three-Stage Codex Delivery Goals

Generated: 23 June 2026

This document turns the master product prompt into three Codex-executable delivery stages. Each stage has its own `/goal`, measurable Definition of Done, quality gates and explicit out-of-scope boundaries.

The full master prompt remains the product specification. This file is the staged execution plan.

---

## How to use this with Codex

Use one stage at a time.

1. Put the full master prompt in `docs/product-spec.md`.
2. Put enduring engineering rules in `AGENTS.md`.
3. Put this file in `docs/codex-three-stage-goals.md`.
4. Start Codex with Stage 1 only.
5. Do not start Stage 2 until every Stage 1 Definition of Done item passes.
6. Do not start Stage 3 until every Stage 1 and Stage 2 Definition of Done item still passes.

Suggested Codex instruction:

```text
Read AGENTS.md, docs/product-spec.md and docs/codex-three-stage-goals.md.
Execute only the current stage goal I provide.
Do not implement later-stage features unless they are needed as safe extension points.
Do not create placeholder UI, fake workflows, hard-coded reports or security theatre.
```

---

## Non-negotiables for every stage

These rules apply throughout all three stages.

- Keep the product provider-neutral. Agents, workflow, retrieval and reporting must not depend on one model provider SDK.
- Use structured data first. Reports, findings, routes and agent outputs must not be stored only as prose.
- Treat all source material as untrusted evidence, never as system instructions.
- Never invent citations. Every material claim must resolve to a source locator, external source, inference, assumption or unknown.
- Enforce tenant isolation and object-level authorisation in backend code and tests.
- Use secure defaults and fail closed for authentication, authorisation, provider routing, source access and sensitive tool use.
- No long-lived provider credentials may be exposed to the browser.
- No hand-written source code file may exceed 400 physical lines, Markdown excluded.
- TypeScript strict mode and Python type checking must remain enabled.
- Domain and application layers must not import FastAPI, SQLAlchemy ORM models, Celery, React internals or vendor model SDKs.
- The UI must be premium, responsive, accessible and dark-mode-first from the beginning.
- Every feature must include failure states, tests, observability and security acceptance criteria.


## Cross-stage engineering principle gates

These are not optional style preferences. They are architectural acceptance criteria for every stage and must be checked before a stage is called complete.

### SOLID and maintainability gate

- **Single responsibility:** each route, service, component, hook, adapter, ingestor, policy and workflow step must have one clear reason to change.
- **Open-closed:** new agents, providers, ingestors, exporters, tools and report sections must be added through typed registries, configuration and adapters rather than large central conditional blocks.
- **Liskov substitution:** every provider, storage, retrieval, ingestion and workflow implementation must satisfy the same contract tests and error semantics as its declared interface.
- **Interface segregation:** use small capability-specific ports such as text generation, embeddings, transcription, storage, search, ingestion and export rather than broad god interfaces.
- **Dependency inversion:** domain and application logic depend on abstractions. FastAPI, SQLAlchemy, Celery, Redis, object storage, React framework details and vendor SDKs remain infrastructure concerns.
- Do not add abstractions purely for ceremony. Add them where they isolate a real source of change, protect a trust boundary, enable contract testing or make replacement practical.
- Avoid service locators, global mutable state, circular imports and hidden singleton dependencies.
- Keep transaction boundaries explicit in application use cases.

### Small-code and anti-god-object gate

- The 400-line limit is a hard failure, not a formatting preference.
- Treat 300 lines as a refactoring warning.
- Do not evade the rule with giant functions, huge JSX blocks, nested local components, catch-all `utils` modules or meaningless file fragmentation.
- No route handler may contain business workflow logic. A route validates transport input, calls one use case and translates the result.
- No React route component may act as data loader, state store, form controller, presentation layer and API mapper at the same time.
- No provider adapter, source ingestor, workflow service, report composer or agent runner may become a god object.
- Reviewers must be able to trace a core use case through a small, explicit set of cohesive modules.

### Secure-by-design gate

- Every feature starts with assets, actors, data classification, entry points, trust boundaries, abuse cases, failure modes and security acceptance tests.
- Authentication, authorisation, tenant isolation, provider routing, tool permissions and data classification are enforced by deterministic application code, never by model prompts.
- Security-sensitive failures fail closed.
- Sensitive values must not appear in browser storage, browser bundles, logs, traces, error responses, prompt metadata or client responses.
- Source material, OCR text, transcripts, websites, code comments, provider responses and model output are untrusted until validated.
- Security controls must have executable tests, not only documentation.

### Evidence and auditability gate

- Reports, findings, assumptions, evidence gaps, actions, provider routes and quality gates are stored as structured data first.
- Every material finding must resolve to a source locator, external source, inference, assumption or unknown.
- A completed run must record the source versions, context-pack versions, prompt versions, selected agents, excluded agents, model profile, provider connection, adapter version, model identifier, capability snapshot, routing decision, usage and fallback history.
- The system must never claim exhaustive coverage or professional sign-off.

## Cross-stage acceptance metrics

These metrics are release-blocking for every stage goal.

- Frontend unit test coverage must be 95% or higher.
- Backend unit test coverage must be 95% or higher.
- Frontend and backend coverage are measured separately. Do not average them together to hide weak coverage in one layer.
- CI must fail when either frontend or backend unit coverage falls below 95%.
- Coverage reports must be included in every stage completion report with the exact measured percentage, tool used and command run.
- Coverage thresholds are a minimum quality gate, not a claim of exhaustive testing or professional sign-off.

---

## Stage overview

| Stage | Name | Main outcome |
|---|---|---|
| 1 | Secure Foundation and Vertical Slice | A working end-to-end product for secure evidence-led reviews using core inputs, core agents and provider-neutral routing. |
| 2 | Rich Evidence, Research and Advanced Review | Broader input support, external research, richer analysis modes, more agents, more providers and stronger evaluation. |
| 3 | Enterprise, Governance and Production Readiness | Team workspaces, enterprise controls, advanced audit, governance, operational hardening and scale-ready release gates. |

Each later stage inherits all previous stage requirements.

---

# Stage 1: Secure Foundation and Vertical Slice

## Codex `/goal`

```text
/goal

Build Stage 1 of the Red Teaming Agent platform: a secure, provider-neutral, end-to-end vertical slice.

The application must let a user register, log in, create a project, create a review, add text and supported documents, ingest evidence, route relevant agents, run a structured review, stream progress and view an interactive evidence-linked report.

Use:

- React, TypeScript, Vite and React Router for the frontend
- FastAPI, Pydantic and SQLAlchemy for the backend
- PostgreSQL with pgvector
- Redis
- S3-compatible object storage via MinIO for local development
- Docker Compose
- a deterministic fake AI provider for tests and local demo
- canonical provider contracts with native OpenAI, Anthropic, Google Gemini and generic OpenAI-compatible text-generation adapters

Start by producing:

1. architecture decision summary
2. threat model and trust-boundary Mermaid diagram
3. initial data model
4. workflow state model
5. repository tree
6. Stage 1 implementation plan

Then implement the Stage 1 vertical slice.

Do not build a novelty multi-agent chat room. Build an auditable decision-support system with source-linked findings, structured outputs, visible uncertainty and deterministic policy enforcement.

Do not create placeholder buttons, fake authentication, hard-coded report data or frontend-only flows. The deterministic fake provider is allowed only for tests and local demonstration.
```

## Stage 1 scope

Deliver the foundation that proves the architecture works end to end.

### Product capabilities

- User registration, email verification, login, logout and password reset.
- Personal workspace automatically created for each user.
- Basic workspace roles: owner, administrator, member and viewer.
- Projects and reviews.
- New-review composer with title, proposal text, attachments, mode selector and focus chips.
- Source cards showing ingestion state, warnings and failures.
- Preflight summary showing sources, selected mode, selected agents, excluded agents, external research setting, provider routes and capability warnings.
- Clarification step with up to five high-value questions and an option to continue with stated assumptions.
- Running screen with stage timeline and Server-Sent Events progress.
- Cancel and retry controls for safe stages.
- Report screen with filters, expandable evidence, risk cards and methodology appendix.
- Exports to Markdown, JSON and printable HTML.
- Dark-mode-first UI with persistent light mode.

### Initial supported inputs

- Pasted text.
- TXT.
- Markdown.
- PDF.
- DOCX.

### Initial agents

- Evidence and Context Agent.
- Alternative Perspectives Agent.
- Software Architecture and Quality Agent.
- Cybersecurity and Privacy Agent.
- Legal and Regulatory Agent.
- Internal Policy and Governance Agent.
- Product and User Experience Agent.
- Operations and Delivery Agent.

### Initial model/provider work

- Canonical model provider contracts.
- Adapter registry.
- Model capability records.
- Model profiles.
- Deterministic model router.
- Native text-generation adapters for OpenAI, Anthropic and Google Gemini.
- Generic OpenAI-compatible text-generation adapter.
- Deterministic fake provider.
- Provider connection settings UI rendered from adapter configuration schemas.
- Provider test connection flow.
- Model catalogue sync or manual model registration.
- Capability probe UI and records.

### Initial backend architecture

- Modular monolith.
- Clear domain, application, interface-adapter and infrastructure boundaries.
- Repository ports for persistence.
- Source ingestion pipeline.
- Evidence pack model.
- Hybrid retrieval using PostgreSQL full-text search and pgvector.
- Workflow engine interface with an initial local/Celery-backed implementation.
- Structured audit events.
- Typed domain exceptions and central error translation.

### Initial frontend architecture

- Feature-oriented modules.
- Strict TypeScript.
- Zod validation at API boundaries.
- Generated or derived API client from OpenAPI.
- Design tokens for colour, typography, spacing, elevation, motion, focus rings and breakpoints.
- Component states for loading, empty, disabled, error, partial failure, success, long content and mobile layouts.

## Stage 1 Definition of Done

Stage 1 is done only when all of the following are true.

### Functional DoD

- A user can register, verify email, log in, log out and reset a password.
- Passwords are hashed with Argon2id.
- Auth uses secure HttpOnly cookies or server-side sessions, not local-storage bearer tokens.
- A personal workspace is created for each new user.
- Workspace membership and role checks are enforced server-side.
- A user can create, view, update and delete a project they are authorised to access.
- A user can create a review from mobile and desktop layouts.
- A user can paste an idea or proposal into the review composer.
- A user can upload TXT, Markdown, PDF and DOCX files.
- Source ingestion validates type, size and workspace ownership.
- Source ingestion stores originals outside the public web root using random object keys.
- Source extraction produces text, metadata, source locators and warnings.
- Failed extraction is visible to the user and never silently omitted from coverage.
- A user can create a Markdown-based context pack and assign it to an agent.
- Context packs are versioned and cited like other evidence.
- Provider connections can be created and tested for OpenAI, Anthropic, Google Gemini, generic OpenAI-compatible and fake provider adapters.
- Provider credentials are never returned to the browser after submission.
- Provider configuration forms are generated from adapter schemas.
- Models can be synchronised or manually registered.
- Model capability provenance and verification status are visible.
- A user can create model profiles and assign them to agents.
- Preflight rejects a route when the selected model lacks a required capability.
- Preflight shows the resolved routing plan and permitted fallbacks.
- Fallback cannot weaken data classification, residency policy or explicit model pinning.
- Basic, Standard and In-depth modes change budgets, challenge passes and report depth.
- The router selects relevant agents and explains selected and excluded agents.
- Specialist outputs are validated against strict schemas.
- Invalid structured model output triggers bounded repair or a clear task failure.
- A run progresses through intake, ingestion, framing, agent planning, specialist review, reconciliation, report composition and quality gate.
- Run progress streams using Server-Sent Events.
- Run progress survives page refresh.
- A user can cancel a running review.
- The report contains provisional recommendation, executive summary, coverage map, top risks, dependencies, blockers, assumptions, evidence gaps, specialist findings, recommended actions, sources and methodology.
- Every material finding has a resolvable source locator or is explicitly labelled as inference, assumption or unknown.
- Unsupported claims are rejected or labelled.
- Users can filter findings by severity, confidence, agent and category.
- Users can export the report as Markdown, JSON and printable HTML.

### Engineering DoD

- Docker Compose starts web, API, worker, PostgreSQL, Redis, MinIO and optional scanner services from documented commands.
- Frontend production build succeeds.
- Backend starts without external provider credentials when fake provider is enabled.
- OpenAPI documentation is generated.
- Frontend API client is generated or derived from OpenAPI.
- No hand-written source file exceeds 400 physical lines, Markdown excluded.
- A cross-platform line-count check fails CI with a clear diagnostic.
- TypeScript strict mode passes.
- Python type checking passes.
- Formatting and linting pass.
- Architecture-boundary tests pass.
- SOLID principle review passes for changed modules, with any deliberate deviation documented in the stage completion report.
- No central `if provider == ...`, `if agent == ...` or `if source_type == ...` chain controls extension points where registries or typed adapters are required.
- Route handlers call one application use case and do not contain business workflow logic.
- React route components compose feature components and do not become multi-purpose state, data and presentation controllers.
- Provider, storage, search, ingestion, workflow and export ports are small and capability-specific.
- Domain and application modules have no direct dependency on FastAPI, SQLAlchemy ORM classes, Celery, React internals or vendor model SDKs.
- Provider, storage, search and ingestion implementations have shared contract tests.
- The fake provider can simulate valid output, invalid schema output, missing capability, timeout, rate limit and partial stream.
- Unit tests cover domain policies, routing, ingestion decisions, report quality gates and authorisation checks.
- Frontend and backend unit coverage are each 95% or higher, enforced by CI as separate release-blocking gates.
- Integration tests cover source upload, context packs, provider setup, workflow run and report retrieval.
- End-to-end tests cover registration, login, project creation, source upload, context pack creation, fake-provider review run and report viewing.

### Security DoD

- Threat model exists and covers assets, actors, trust boundaries, data flows, provider egress, upload handling, prompt injection and tenant isolation.
- Security acceptance tests exist for object-level authorisation, tenant isolation, prompt injection, upload handling, provider endpoint validation and schema failure.
- Cross-workspace access tests pass for projects, reviews, sources, context packs, runs and reports.
- IDOR tests pass for all workspace-owned resources.
- File upload tests cover MIME spoofing, unsupported file type, oversized file and malicious filename.
- Prompt-injection tests prove source text cannot override system instructions, provider routing, tool permissions or report quality gates.
- Provider endpoint validation blocks private, loopback, link-local and cloud metadata addresses in hosted mode.
- Self-hosted private endpoint exceptions require explicit administrator-enabled local/self-hosted mode.
- Secrets are absent from browser bundles, client storage, logs, traces and error responses.
- Secret scanning passes across code and build artefacts.
- Dependency scanning reports no unresolved critical or high exploitable issue.
- Safe Markdown and HTML sanitisation is used for report rendering.
- CSRF protection exists where cookie auth is used.
- Rate limiting exists for login, password reset, upload and expensive review operations.

### UI, accessibility and performance DoD

- Core journeys meet WCAG 2.2 AA.
- Keyboard-only navigation works for login, new review, source upload, running screen, report filters and settings.
- Automated accessibility checks pass for login, new review, running, report and provider settings screens.
- Visual regression baselines exist for login, new review, running screen, report and provider settings.
- Visual baselines cover dark and light themes.
- Responsive checks pass at approximately 360 px, 390 px, 768 px, 1024 px, 1440 px and 1920 px.
- No critical journey requires horizontal page scrolling.
- Loading, empty, partial-failure, error and success states are implemented for source ingestion, provider setup, run progress and report loading.
- Report rendering remains responsive with at least 50 findings.
- Performance budgets are documented for app shell load, interaction response, run progress updates and report rendering.

### Documentation DoD

- README documents setup, local development, environment variables, provider configuration, fake provider usage, testing and known limitations.
- Architecture docs explain module boundaries and dependency direction.
- ADRs exist for modular monolith, provider-neutral model layer, workflow abstraction, source ingestion model, authentication approach and structured-report approach.
- Threat model includes a Mermaid trust-boundary diagram.
- Known limitations are documented rather than hidden.

## Stage 1 out of scope

Do not implement these yet unless they are needed as safe extension points.

- PPTX, spreadsheet, image, audio or video ingestion.
- Website snapshots.
- Git repository ingestion.
- External web research.
- Organisation workspaces beyond personal workspace foundations.
- SSO, SCIM and MFA.
- Custom agent marketplace.
- Arbitrary tool execution.
- Automatic execution of uploaded code.
- Full enterprise audit dashboards.
- PDF export.
- Advanced report comparison.

---

# Stage 2: Rich Evidence, Research and Advanced Review

## Codex `/goal`

```text
/goal

Build Stage 2 of the Red Teaming Agent platform: rich evidence handling, external research, complete specialist coverage and advanced review depth.

Keep all Stage 1 behaviour working. Extend the product to support richer inputs, website and repository ingestion, external research, additional provider adapters, policy-constrained model diversity, the full specialist agent registry, richer reports and stronger evaluation.

Do not weaken Stage 1 security, provider neutrality, typed schemas, tenant isolation, accessibility or file-size rules.

Before coding, update the architecture decision summary, threat model, data model, workflow state model and implementation plan for Stage 2 changes.
```

## Stage 2 scope

Stage 2 turns the vertical slice into a broader and more capable product.

### New input support

- PPTX.
- CSV.
- XLSX.
- PNG, JPEG and WebP.
- OCR for images and scanned PDFs where needed.
- Browser voice recording.
- Common audio file transcription with timestamps.
- Common video file ingestion by extracting audio and representative frames.
- Public website URL ingestion with hardened fetching and reproducible snapshots.
- Uploaded ZIP and TAR codebase archives.
- Public Git repository ingestion.

### External research

- SearchProvider abstraction.
- Explicit per-run external research permission.
- Private research mode.
- Query sanitisation.
- Domain allow and block lists.
- Source-quality ranking.
- External source records with title, publisher, URL, publication date, access date and relevant excerpt.
- User-visible external queries in high-sensitivity mode.

### Provider and routing expansion

- Azure OpenAI adapter.
- Azure AI model endpoint adapter.
- Amazon Bedrock adapter.
- Google Vertex AI adapter.
- Local/self-hosted adapters such as Ollama and vLLM.
- Optional approved multi-provider gateway connector.
- Embedding provider contracts where not already complete.
- Transcription provider contracts.
- Rerank provider contracts.
- Cross-provider diversity for selected Standard and In-depth review paths.
- Richer capability probes for tool use, schema output, streaming, image input, transcription and embeddings.

### Full specialist registry

Add the remaining specialist agents:

- Comparable Products and External Research Agent.
- Physical and Systems Engineering Agent.
- Mathematics and Statistics Agent.
- Medical and Clinical Safety Agent.
- Language, Grammar and Clarity Agent.
- Ethics and Responsible Use Agent.
- Inclusivity, Accessibility and Human Factors Agent.
- Commercial and Financial Agent.
- Data and AI Agent.
- Future Development and Second-Order Effects Agent.
- Environmental and Sustainability Agent.
- Reputation, Communications and Stakeholder Agent.

### Advanced reports

- PDF export.
- Risk matrix visualisation.
- Dependency relationships.
- Time-horizon views.
- Evidence quality scoring.
- Cross-agent disagreement view.
- Strongest case for and against the proposal.
- Pre-mortem section.
- Best, base and worst plausible scenarios.
- Recommended validation experiments.
- Action tracking with status.
- Report comparison between proposal versions.

### Evaluation expansion

- Evaluation suite for agent-routing precision and recall.
- Citation validity measurement.
- Unsupported-claim rate measurement.
- Locator accuracy measurement.
- Duplicate-finding rate measurement.
- Contradiction detection measurement.
- Prompt-injection resistance tests across PDFs, websites and code comments.
- Provider portability conformance tests across expanded adapters.

## Stage 2 Definition of Done

Stage 2 is done only when Stage 1 still passes and all of the following are true.

### Functional DoD

- Users can upload and ingest PPTX, CSV, XLSX, PNG, JPEG and WebP files.
- OCR runs only when needed and records confidence or quality warnings.
- Users can record a voice note in the browser and submit it as a source.
- Audio files are transcribed with timestamps.
- Video files produce audio transcripts and representative frame sources.
- Website ingestion uses hardened fetching with scheme allow-listing, DNS revalidation, redirect revalidation, private-network blocking, size caps and timeout caps.
- Website snapshots are stored so reports remain reproducible.
- Uploaded code archives are safely unpacked with protection against path traversal, symlinks, excessive nesting and decompression bombs.
- Public Git repositories can be ingested without executing code.
- Codebase ingestion creates a manifest, language summary, dependency/config index and source locators by file path and line range.
- Secret-like values in sources are flagged or redacted according to workspace policy before external processing.
- External research can be enabled or disabled per review.
- Private research mode avoids proprietary or sensitive search queries.
- External source records are reproducible and cited separately from user-provided sources.
- The full specialist registry is implemented as configuration plus code, not duplicated hard-coded workflows.
- The router can select any implemented specialist and explain selection or exclusion.
- In-depth mode can use policy-constrained model diversity where configured.
- A fallback route is visible and recorded whenever it occurs.
- Reports include pre-mortem, scenarios, validation experiments, cross-agent disagreements, dependency visualisation and action tracking.
- Users can compare two report versions and see changed risks, assumptions, evidence gaps and recommendations.
- Users can export PDF reports.

### Engineering DoD

- New ingestors conform to the shared SourceIngestor contract.
- New provider adapters conform to the same capability-specific contracts as Stage 1 adapters.
- Shared conformance tests cover every capability each provider claims.
- Capability probes cover text, structured output, streaming, tool use, image input, embeddings, transcription and reranking where applicable.
- Hybrid retrieval supports metadata filters, lexical search, vector search and optional reranking.
- Source locators resolve for PDF pages, DOCX headings/paragraphs, PPTX slides, spreadsheet sheet/cell ranges, image regions/OCR blocks, audio/video timestamps, code paths/lines and website snapshots.
- Background jobs are idempotent or document an explicit idempotency strategy.
- Retry policy distinguishes transient from permanent failures.
- No new source file breaches the 400-line limit.
- Stage 1 architecture-boundary rules still pass.
- Contract tests cover storage, search, ingestion, providers, workflow events and exporters.

### Security DoD

- Threat model is updated for OCR, transcription, website ingestion, code archive handling, public Git ingestion, external search and local/self-hosted providers.
- SSRF tests cover redirects, DNS rebinding, IPv6, cloud metadata addresses, loopback, private ranges, link-local ranges and blocked schemes.
- Archive tests cover path traversal, symlinks, decompression bombs, nested archives and malicious filenames.
- Prompt-injection tests cover PDF text, website content, image OCR, transcripts and code comments.
- Code ingestion never executes uploaded or cloned code during ordinary review.
- Any future sandbox execution path remains disabled unless explicit approval and sandbox controls are implemented.
- External research tests prove confidential source text is not placed into search queries without explicit approval.
- Provider routing tests prove model diversity and fallback cannot violate data classification, residency, provider pinning or local-only policies.
- PDF export sanitises rendered content and cannot execute embedded scripts.
- Expanded dependency and container scans pass with no unresolved critical or high exploitable issue.

### UI, accessibility and performance DoD

- Upload cards support rich previews, extraction warnings and quality indicators for all new source types.
- Website, repository, audio, video and image ingestion states are clear and recoverable.
- Report visualisations do not rely on colour alone.
- Large reports remain usable on mobile through drill-down, bottom sheets or focused views rather than squeezed desktop panels.
- Visual regression baselines cover new source upload states, research settings, report comparison, risk matrix and action tracking.
- Accessibility checks pass for all new Stage 2 journeys.
- Performance budgets exist for OCR, transcription, website ingestion, repository indexing, large reports and PDF export.
- Large-source workflows enforce file size, duration, extracted text, page count, repository file count and website page count limits.

### Evaluation DoD

- Evaluation fixtures exist for at least ten representative review scenarios.
- Evaluation metrics are generated for routing precision and recall, citation validity, unsupported claims, duplicate findings, contradiction detection and report completeness.
- Adversarial fixtures exist for malicious documents, malicious websites, malicious code comments, fabricated citations, conflicting context packs and malformed provider output.
- Fake provider scenarios cover malformed streams, retired models, stale capability snapshots, capability mismatch and fallback-policy violations.
- CI can run deterministic evaluation without live provider credentials.
- Optional live smoke tests use non-sensitive synthetic prompts only.

### Documentation DoD

- README documents all Stage 2 input types, limits, research modes and provider adapters.
- Threat model documents new trust boundaries and egress paths.
- ADRs exist for website ingestion, repository/code ingestion, OCR/transcription strategy, external research and model diversity.
- User-facing limitations explain that reports are decision support and not legal, medical, financial or engineering sign-off.

## Stage 2 out of scope

Do not implement these yet unless agreed separately.

- SSO and SCIM.
- Organisation-wide enterprise administration.
- Custom agent approval workflows.
- Public report sharing.
- Bring-your-own-storage controls.
- Data residency enforcement beyond routing policy foundations.
- Outcome learning dashboards.
- Periodic scheduled re-review.
- Agent marketplace.
- Autonomous real-world actions.

---

# Stage 3: Enterprise, Governance and Production Readiness

## Codex `/goal`

```text
/goal

Build Stage 3 of the Red Teaming Agent platform: enterprise workspaces, governance, advanced administration, operational hardening and production readiness.

Keep all Stage 1 and Stage 2 behaviour working. Extend the platform with organisation workspaces, invitations, refined RBAC, SSO-ready identity design, central provider governance, data retention controls, advanced audit, customisation, evaluation dashboards, operational monitoring and release-grade security gates.

Do not weaken provider neutrality, tenant isolation, source trust boundaries, prompt-injection controls, accessibility, typed schemas or the 400-line source-file rule.

Before coding, update the architecture decision summary, threat model, data model, workflow state model, operational model and implementation plan for Stage 3 changes.
```

## Stage 3 scope

Stage 3 makes the platform credible for team and enterprise use.

### Organisation and collaboration

- Organisation workspaces.
- Workspace invitations.
- Refined RBAC.
- Project-level permissions where needed.
- Team comments and review collaboration.
- Decision journal capturing initial confidence, final decision and rationale.
- Action owners, due dates and status.
- Notifications.
- Report sharing with expiring links and access controls.

### Enterprise identity and governance

- SSO-ready architecture.
- Optional MFA.
- SCIM-ready user and group model.
- Central provider management.
- Provider allow-lists by workspace, data classification, region and purpose.
- Model allow-lists by workspace, data classification, region and purpose.
- Data retention policies.
- Export and deletion workflows.
- Data residency controls.
- Custom branding.
- Organisation-wide context libraries.
- Approved domain lists for external research.
- Jurisdiction and industry packs.

### Advanced extensibility

- Administrator-approved custom agent definitions.
- Custom risk rubrics.
- Custom report templates.
- API access and webhooks.
- Periodic re-review when policies, context packs or external facts change.
- Outcome tracking to learn which risks materialised.
- Model comparison and evaluation dashboards.

### Production hardening

- Advanced audit inspector.
- Tamper-evident audit events where practical.
- Operational metrics and dashboards.
- Distributed tracing with sensitive-content redaction.
- Quotas and circuit breakers by user, workspace, provider, model and review.
- Backup and restore documentation.
- Migration and rollback procedures.
- Disaster recovery plan.
- SBOM for production artefacts.
- Reproducible production builds.
- Production security headers and strict CSP.
- Production deployment guide.

## Stage 3 Definition of Done

Stage 3 is done only when Stage 1 and Stage 2 still pass and all of the following are true.

### Functional DoD

- Organisation workspaces can be created and administered.
- Users can invite members to organisation workspaces.
- Workspace roles are enforced consistently across projects, sources, context packs, provider settings, reviews, runs and reports.
- Project-level permissions exist where the data model requires finer access than workspace membership.
- Users can comment on reports and findings where authorised.
- Users can assign actions to owners with due dates and statuses.
- Decision journal captures initial confidence, final decision, rationale and linked report version.
- Notifications exist for completed runs, failed runs, assigned actions and comments.
- Reports can be shared through expiring links with explicit access controls.
- SSO-ready identity interfaces exist even if only one SSO implementation is enabled initially.
- MFA can be enabled for a user or workspace where implemented.
- SCIM-ready user and group mapping is represented in the data model and interfaces.
- Administrators can centrally manage provider connections.
- Provider and model allow-lists are enforceable by workspace, role, data classification, region and task purpose.
- Data retention policies can be configured and enforced.
- Users can export their data where authorised.
- Users can request or perform deletion according to policy.
- Historical reports preserve the exact source, context pack, prompt, provider, model and routing versions used at run time.
- Organisation context libraries can be versioned and assigned to agents.
- Approved external research domain lists can be managed by administrators.
- Administrator-approved custom agents can be created, tested, enabled and disabled.
- Custom risk rubrics can be attached to a workspace or review template.
- Custom report templates can be selected without altering structured report data.
- API access and webhooks exist for approved integration scenarios.
- Periodic re-review can be scheduled for policy, context or external-fact changes.
- Outcome tracking captures whether predicted risks materialised.
- Model comparison dashboard shows quality, cost, latency, failure rate and capability coverage.

### Engineering DoD

- Enterprise features are implemented without breaking modular-monolith boundaries.
- RBAC and policy enforcement are centralised in testable application services, not scattered across route handlers.
- Provider governance is enforced by deterministic policy code, not by model prompts.
- API and webhook endpoints are versioned and documented.
- Webhook signing and replay protection are implemented.
- Scheduled jobs are idempotent and observable.
- Data retention jobs are safe, auditable and tested.
- Export and deletion workflows are resumable and auditable.
- Migration and rollback procedures are documented and tested in CI or staging scripts.
- No new source file breaches the 400-line limit.
- Architecture-boundary tests cover new enterprise modules.
- Contract tests cover custom agents, custom rubrics, report templates, webhooks and scheduled re-review.

### Security and governance DoD

- Threat model is updated for organisation workspaces, invitations, report sharing, API access, webhooks, retention, deletion, SSO, custom agents and scheduled re-review.
- Security tests cover invitation abuse, privilege escalation, project-level access, report-sharing access, expired links, webhook replay, API token misuse and custom-agent prompt injection.
- Admin actions are audited.
- Provider-routing policy decisions are audited.
- Report-sharing access is logged.
- Data export and deletion events are audited.
- Audit logs avoid sensitive raw content by default.
- Tamper-evident audit storage is implemented or a documented compensating control exists.
- Data residency tests prove disallowed provider routes are rejected before model calls.
- Retention tests prove expired data is removed or anonymised according to policy without mutating historical audit facts incorrectly.
- Custom agents cannot bypass tool permissions, provider policy, context boundaries or output schema validation.
- API tokens are scoped, revocable, rate-limited and never stored in plaintext.
- Webhooks do not leak cross-tenant data.
- Production CSP, secure headers, CORS allow-lists, cookie settings and rate limits are enforced.
- CI produces dependency and security scan results, container scan results, infrastructure scan results where applicable and an SBOM.
- No unresolved critical or high exploitable issue remains at release unless a documented exception has an owner, expiry and compensating control.

### Observability and operations DoD

- Run inspector can reconstruct available evidence, retrieved excerpts, selected agents, prompt versions, routing decisions, provider calls, findings, reconciliation decisions and report quality gates.
- Operational dashboards show run volume, failure rates, latency, cost, provider health, queue depth, source-ingestion failures, report quality failures and security events.
- Tracing redacts sensitive content by default.
- Quotas and circuit breakers work by user, workspace, provider, model and review.
- Backup and restore procedures are documented and tested.
- Disaster recovery plan exists with recovery time and recovery point objectives.
- Production deployment guide documents secrets, environment variables, network egress, storage, migrations, workers, monitoring and rollback.
- Reproducible production builds are generated.

### UI, accessibility and performance DoD

- Organisation settings, member management, provider governance, data retention, audit, action tracking and customisation screens meet WCAG 2.2 AA.
- Keyboard-only operation works for administration and collaboration flows.
- Visual regression baselines cover organisation settings, member management, action tracking, audit inspector, provider governance and model comparison.
- Responsive checks pass for all new enterprise screens.
- Large workspaces remain usable with pagination, search, filtering and sensible empty states.
- Performance budgets exist for organisation dashboards, audit search, large report lists, model comparison and scheduled re-review queues.
- CI exposes performance regressions for critical journeys.

### Documentation DoD

- Administrator guide documents organisation setup, roles, provider governance, retention, report sharing, API access, webhooks and audit.
- Security guide documents threat model, data classification, provider egress, tenant isolation, custom-agent governance and incident response.
- Operations guide documents deployment, monitoring, backup, restore, migrations, rollback and disaster recovery.
- API documentation includes authentication, rate limits, scopes, webhook signing and examples.
- User guide explains review creation, context packs, reports, actions, decision journal and limitations.

## Stage 3 out of scope

These remain out of scope unless explicitly authorised.

- Unreviewed public agent marketplace.
- Arbitrary user-uploaded executable plug-ins.
- Autonomous actions outside reporting and approved workflow operations.
- Automatic execution of uploaded code without explicit sandbox approval.
- Claims of legal, medical, engineering or financial certification.
- Public sharing by default.
- Exposure of hidden model chain-of-thought.

---

# Final product release gate

The product is release-ready only when:

- Stage 1, Stage 2 and Stage 3 Definitions of Done all pass.
- All known critical and high exploitable issues are fixed or covered by documented, time-bounded exceptions with owners and compensating controls.
- The full core workflow is usable on mobile and desktop.
- Reports remain evidence-linked, uncertainty-aware and non-exhaustive in wording.
- Provider routing remains deterministic, explainable and policy-constrained.
- Tenant isolation is proven through automated tests.
- Prompt injection from user sources, websites, OCR, transcripts and code comments cannot alter system instructions, provider routing, tool permissions or report quality gates.
- Every material finding resolves to evidence, external source, inference, assumption or unknown.
- The UI feels cohesive, premium and production-polished rather than a generic dashboard.
- Documentation honestly states supported inputs, limitations, data handling, provider behaviour and high-stakes domain caveats.

---

# Suggested repository documentation layout

```text
red-team-agent/
  AGENTS.md
  docs/
    product-spec.md
    codex-three-stage-goals.md
    architecture/
      architecture-decision-summary.md
      data-model.md
      workflow-state-model.md
      provider-neutral-ai.md
      retrieval-and-evidence.md
    threat-model/
      threat-model.md
      trust-boundaries.mmd
      abuse-cases.md
      security-acceptance-tests.md
    adr/
      0001-modular-monolith.md
      0002-provider-neutral-model-layer.md
      0003-workflow-engine-abstraction.md
      0004-source-ingestion-and-evidence-model.md
      0005-authentication-and-session-model.md
      0006-structured-report-data.md
    delivery/
      stage-1-plan.md
      stage-2-plan.md
      stage-3-plan.md
      release-gates.md
```

---

# Codex stage transition rule

At the end of each stage, Codex must produce a completion report containing:

- completed capabilities;
- failed or incomplete DoD items;
- security issues found and fixed;
- security issues accepted with owner and expiry;
- test results;
- accessibility results;
- visual regression results;
- performance results;
- migration or rollback notes;
- updated documentation list;
- known limitations;
- recommended next stage readiness decision.
- SOLID and maintainability checklist result;
- file-size and anti-god-object review result;
- secure-by-design acceptance test result;

If any release-blocking DoD item fails, the stage is not complete.
