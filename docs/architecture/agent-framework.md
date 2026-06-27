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

## Specialist Context Packs

Knowledge references are configured by key and should be maintained as versioned content packs. Examples:

- `uk-gov-secure-by-design`: UK Government Secure by Design principles.
- `ncsc-secure-development`: NCSC secure development and deployment guidance.
- `ncsc-caf`: NCSC Cyber Assessment Framework.
- `ico-uk-gdpr-principles`: ICO UK GDPR data protection principles.
- `ico-lawful-basis`: ICO lawful-basis guidance.
- `ico-controller-processor`: ICO controller and processor guidance.
- `owasp-asvs`: OWASP Application Security Verification Standard.
- `owasp-top-10`: OWASP Top 10.
- `owasp-zap-automation`: OWASP ZAP Automation Framework.
- `wcag-22`: W3C WCAG 2.2.

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
