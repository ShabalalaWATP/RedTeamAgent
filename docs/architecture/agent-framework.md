# Agent Framework

RedTeamAgent uses a controlled orchestrator with lazily loaded specialist agents. The orchestrator must decide which agents run, which agents stay unloaded, which context packs can be materialised and which tools are available.

## Design Principles

- Select the smallest useful specialist set for the review, then record selected and excluded agents with reasons.
- Keep specialist standards, legal references and tool instructions out of the orchestrator context unless the agent is selected.
- Store context-pack hashes in the run plan. Load full Markdown only for the selected agent that owns that pack.
- Treat tools as explicit capabilities, not as prompt instructions. Tool grants are recorded in the run `tool_manifest`.
- Keep active or externally observable tools disabled unless the request and policy explicitly authorise them.
- Run assurance agents after specialist planning: source provenance and quality/fact checking are mandatory.

## Runtime Stages

1. Intake builds a review summary from title, proposal, focus chips and source content types.
2. Agent planning evaluates compact agent cards and emits selected specialists, exclusions, assurance agents, tool manifest and lazy context strategy.
3. Specialist review loads only the selected agent cards, matching context packs and allowed tools.
4. Reconciliation deduplicates findings and records disagreements.
5. Quality assurance verifies evidence labels, unsupported-claim handling, recommendation presence and coverage metadata.
6. Report composition stores specialist outputs, assurance output and routing provenance.

## Agent Hierarchy

The hierarchy is deliberately shallow:

1. **Orchestrator:** reads the review frame, source types and focus chips. It sees compact agent cards only, selects the smallest useful specialist set, records exclusions and builds the tool manifest. It must not load full specialist knowledge packs by default.
2. **Selected specialist agents:** receive their own compact card, the review setup, retrieved evidence excerpts, matching context-pack references and only the tool permissions granted in the run plan. Each selected specialist must return at least one usable structured claim or the run fails closed.
3. **Assurance agents:** `source_provenance` and `quality_fact_checker` are mandatory assurance lanes. They check source quality, prompt-injection boundaries, claim support, severity calibration and recommendation presence.
4. **Report composer:** converts validated LLM claims into report data. It must not invent fallback findings when LLM agents return no usable claims.

Non-selected agents are not loaded. Their knowledge refs and specialist instructions stay out of context and the run records an exclusion reason.

## Agent Registry

This table is the production registry implemented in `apps/api/app/domain/agents.py`.

| Key | Agent | Stage | Minimum mode | Default | Routing triggers | Knowledge refs | Tool permissions |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `evidence_context` | Evidence and Context Agent | specialist | basic | yes | evidence, source, citation, context, document, photo, voice, transcript | none | `read_sources` |
| `alternative_perspectives` | Alternative Perspectives Agent | specialist | standard | no | alternative, challenge, against, trade-off, tradeoff, assumption | none | `read_sources` |
| `software_architecture` | Software Architecture and Quality Agent | specialist | standard | no | code, architecture, repository, api, frontend, backend, database, refactor | `owasp-asvs`, `clean-architecture`, `maintainability-checklist` | `read_sources` |
| `cybersecurity_privacy` | Cybersecurity and Privacy Agent | specialist | basic | no | security, privacy, auth, authentication, session, abuse, threat, vulnerability | `owasp-top-10`, `owasp-asvs`, `threat-modelling` | `read_sources` |
| `secure_by_design` | Secure by Design Agent | specialist | standard | no | secure by design, ncsc, government, risk owner, defence in depth, secure development | `uk-gov-secure-by-design`, `ncsc-secure-development`, `ncsc-caf` | `read_sources` |
| `vulnerability_research_static` | Vulnerability Research Agent (Static) | specialist | standard | no | sast, static, dependency, semgrep, codeql, secret, sbom, trivy, pip-audit | `owasp-asvs`, `cwe-top-25`, `supply-chain-security` | `read_sources`, `static_code_scan`, `dependency_audit`, `secret_scan` |
| `vulnerability_research_dynamic` | Vulnerability Research Agent (Dynamic) | specialist | in_depth | no | zap, dast, dynamic, live site, staging, penetration, pentest, passive scan | `owasp-zap-automation`, `owasp-testing-guide`, `scan-authorisation-policy` | `read_sources`, `http_probe`, `browser_probe`, `zap_baseline_scan`, `zap_passive_scan` |
| `uk_data_protection` | UK Data Protection Agent | specialist | standard | no | gdpr, uk gdpr, ico, personal data, controller, processor, lawful basis, retention | `ico-uk-gdpr-principles`, `ico-lawful-basis`, `ico-controller-processor` | `read_sources` |
| `legal_regulatory` | Legal and Regulatory Agent | specialist | standard | no | legal, regulatory, contract, licence, compliance | none | `read_sources` |
| `policy_governance` | Internal Policy and Governance Agent | specialist | standard | no | policy, governance, board, approval, risk appetite | none | `read_sources` |
| `product_ux` | Product and User Experience Agent | specialist | basic | no | product, ux, user, journey, interface, onboarding | none | `read_sources` |
| `operations_delivery` | Operations and Delivery Agent | specialist | standard | no | delivery, operations, launch, rollout, support, runbook, incident | none | `read_sources` |
| `comparable_products_research` | Comparable Products and External Research Agent | specialist | standard | no | market, competitor, research, benchmark, comparable | none | `read_sources` |
| `physical_systems` | Physical and Systems Engineering Agent | specialist | in_depth | no | hardware, systems, physical, safety case | none | `read_sources` |
| `math_statistics` | Mathematics and Statistics Agent | specialist | standard | no | statistics, math, metric, sample, forecast, probability | none | `read_sources` |
| `medical_clinical` | Medical and Clinical Safety Agent | specialist | in_depth | no | medical, clinical, health, patient, diagnosis, treatment | none | `read_sources` |
| `language_clarity` | Language, Grammar and Clarity Agent | specialist | basic | no | essay, language, clarity, writing, copy, recipe, instructions | none | `read_sources` |
| `ethics_responsible_use` | Ethics and Responsible Use Agent | specialist | standard | no | ethics, responsible, harm, fairness, misuse | none | `read_sources` |
| `inclusivity_accessibility` | Inclusivity, Accessibility and Human Factors Agent | specialist | standard | no | accessibility, inclusive, wcag, human factors, disability | `wcag-22` | `read_sources` |
| `commercial_financial` | Commercial and Financial Agent | specialist | standard | no | commercial, financial, finance, budget, pricing, cost, revenue | none | `read_sources` |
| `data_ai` | Data and AI Agent | specialist | standard | no | data, ai, model, dataset, ml, llm, analytics | none | `read_sources` |
| `future_second_order` | Future Development and Second-Order Effects Agent | specialist | in_depth | no | future, second-order, long term, downstream, unintended | none | `read_sources` |
| `environmental_sustainability` | Environmental and Sustainability Agent | specialist | in_depth | no | environment, sustainability, carbon, energy, climate | none | `read_sources` |
| `reputation_stakeholder` | Reputation, Communications and Stakeholder Agent | specialist | standard | no | reputation, stakeholder, press, communications, trust | none | `read_sources` |
| `food_consumer_safety` | Food and Consumer Safety Agent | specialist | basic | no | recipe, food, cooking, ingredient, allergen, kitchen | none | `read_sources` |
| `source_provenance` | Source Provenance Agent | assurance | basic | yes | source provenance, citation quality, evidence quality | `source-trust-policy`, `prompt-injection-defences` | `read_sources` |
| `quality_fact_checker` | Quality and Fact Checker | assurance | basic | yes | quality gate, fact check, unsupported claim | `report-quality-gate`, `claim-verification-rubric` | `read_sources` |

## Specialist Context Packs

Knowledge references are configured by key and maintained as versioned bundled Markdown packs under
`apps/api/app/context_packs/packs`. The run plan records hashes and source URLs, but not full Markdown.
Full pack text is materialised only through an agent-specific helper after the agent has been selected.

Production packs currently include:

- `uk-gov-secure-by-design`: UK Government Secure by Design principles.
- `ncsc-secure-development`: NCSC secure development and deployment guidance.
- `ncsc-caf`: NCSC Cyber Assessment Framework.
- `ico-uk-gdpr-principles`: ICO UK GDPR data protection principles.
- `ico-lawful-basis`: ICO lawful-basis guidance.
- `ico-controller-processor`: ICO controller and processor guidance.
- `owasp-asvs`: OWASP Application Security Verification Standard.
- `owasp-top-10`: OWASP Top 10.
- `owasp-zap-automation`: OWASP ZAP Automation Framework.
- `owasp-testing-guide`: OWASP Web Security Testing Guide.
- `cwe-top-25`: CWE Top 25 software weakness context.
- `supply-chain-security`: dependency, build and supply-chain risk context.
- `clean-architecture`: maintainability and architecture boundary context.
- `maintainability-checklist`: code quality and maintainability checks.
- `wcag-22`: W3C WCAG 2.2.
- `source-trust-policy`: source provenance, locator quality and prompt-injection boundaries.
- `prompt-injection-defences`: prompt-injection and hostile-source handling.
- `report-quality-gate`: final report evidence and recommendation checks.
- `claim-verification-rubric`: claim, evidence and severity validation rubric.

The orchestrator sees these as references. It does not load the full content unless the relevant selected agent executes.

## Tool Policy

Tool sensitivity levels:

- `read_only`: source and metadata inspection.
- `local_analysis`: static code, dependency, secret or SBOM checks.
- `network_read`: browser or HTTP probing without mutation.
- `network_passive_scan`: passive DAST or ZAP baseline checks against authorised targets.
- `active_scan`: active attack simulation. Disabled by default and requires explicit per-run authorisation.

The Dynamic Vulnerability Research agent may receive passive ZAP tools when explicitly selected. `zap_active_scan` is included as disabled metadata only, so the user and audit trail can see the escalation path without silently enabling it.

## Definition Of Done

- A non-security task such as recipe feedback does not select cybersecurity, legal or vulnerability agents.
- A security or privacy task selects relevant security/data-protection specialists and records non-selected agents with reasons.
- Dynamic vulnerability research is selected only by explicit dynamic/DAST/ZAP/staging/pentest terms.
- ZAP passive tools are visible only when the dynamic agent is selected. ZAP active scan remains disabled until explicitly authorised.
- Preflight and run records include `agent_cards`, `assurance_cards`, `tool_manifest`, `context_strategy`, selected agents and exclusions.
- Context-pack provenance includes a SHA-256 hash and `materialised_for_orchestrator=false`.
- Reports include a `quality_assurance` record and fail closed when evidence classifications or source locators are invalid.
- Frontend agent selectors use backend agent keys exactly.
- Unit tests cover routing precision, tool gating, lazy context provenance and quality-gate failure paths.
