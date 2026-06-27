from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.domain.enums import AgentKey

AgentStage = Literal["specialist", "assurance"]


@dataclass(frozen=True)
class SpecialistAgent:
    key: AgentKey
    label: str
    focus_terms: tuple[str, ...]
    minimum_mode: str
    mission: str
    negative_terms: tuple[str, ...] = ()
    knowledge_refs: tuple[str, ...] = ()
    tool_permissions: tuple[str, ...] = ("read_sources",)
    required_capabilities: tuple[str, ...] = ("text", "structured_output")
    stage: AgentStage = "specialist"
    default_select: bool = False
    output_schema: str = "specialist_output"

    def card(self) -> dict[str, object]:
        return {
            "key": self.key.value,
            "label": self.label,
            "mission": self.mission,
            "knowledge_refs": list(self.knowledge_refs),
            "tool_permissions": list(self.tool_permissions),
            "required_capabilities": list(self.required_capabilities),
            "stage": self.stage,
            "output_schema": self.output_schema,
        }


SPECIALIST_REGISTRY: tuple[SpecialistAgent, ...] = (
    SpecialistAgent(
        AgentKey.EVIDENCE_CONTEXT,
        "Evidence and Context Agent",
        ("evidence", "source", "citation", "context", "document", "photo", "voice", "transcript"),
        "basic",
        "Map available evidence, assumptions, source gaps and context boundaries.",
        default_select=True,
    ),
    SpecialistAgent(
        AgentKey.ALTERNATIVE_PERSPECTIVES,
        "Alternative Perspectives Agent",
        ("alternative", "challenge", "against", "trade-off", "tradeoff", "assumption"),
        "standard",
        "Generate plausible counterarguments and decision alternatives.",
    ),
    SpecialistAgent(
        AgentKey.SOFTWARE_ARCHITECTURE,
        "Software Architecture and Quality Agent",
        ("code", "architecture", "repository", "api", "frontend", "backend", "database", "refactor"),
        "standard",
        "Assess maintainability, boundaries, testability and engineering tradeoffs.",
        knowledge_refs=("owasp-asvs", "clean-architecture", "maintainability-checklist"),
    ),
    SpecialistAgent(
        AgentKey.CYBERSECURITY_PRIVACY,
        "Cybersecurity and Privacy Agent",
        ("security", "privacy", "auth", "authentication", "session", "abuse", "threat", "vulnerability"),
        "basic",
        "Assess security and privacy risk at design level without performing active testing.",
        knowledge_refs=("owasp-top-10", "owasp-asvs", "threat-modelling"),
    ),
    SpecialistAgent(
        AgentKey.SECURE_BY_DESIGN,
        "Secure by Design Agent",
        ("secure by design", "ncsc", "government", "risk owner", "defence in depth", "secure development"),
        "standard",
        "Apply UK secure-by-design principles and assurance expectations.",
        knowledge_refs=("uk-gov-secure-by-design", "ncsc-secure-development", "ncsc-caf"),
    ),
    SpecialistAgent(
        AgentKey.VULNERABILITY_STATIC,
        "Vulnerability Research Agent (Static)",
        ("sast", "static", "dependency", "semgrep", "codeql", "secret", "sbom", "trivy", "pip-audit"),
        "standard",
        "Plan static vulnerability research from code, dependencies, secrets and build artefacts.",
        knowledge_refs=("owasp-asvs", "cwe-top-25", "supply-chain-security"),
        tool_permissions=("read_sources", "static_code_scan", "dependency_audit", "secret_scan"),
    ),
    SpecialistAgent(
        AgentKey.VULNERABILITY_DYNAMIC,
        "Vulnerability Research Agent (Dynamic)",
        ("zap", "dast", "dynamic", "live site", "staging", "penetration", "pentest", "passive scan"),
        "in_depth",
        "Plan controlled dynamic testing against authorised web targets.",
        knowledge_refs=("owasp-zap-automation", "owasp-testing-guide", "scan-authorisation-policy"),
        tool_permissions=("read_sources", "http_probe", "browser_probe", "zap_baseline_scan", "zap_passive_scan"),
    ),
    SpecialistAgent(
        AgentKey.UK_DATA_PROTECTION,
        "UK Data Protection Agent",
        ("gdpr", "uk gdpr", "ico", "personal data", "controller", "processor", "lawful basis", "retention"),
        "standard",
        "Assess UK GDPR, data protection and privacy governance considerations.",
        knowledge_refs=("ico-uk-gdpr-principles", "ico-lawful-basis", "ico-controller-processor"),
    ),
    SpecialistAgent(
        AgentKey.LEGAL_REGULATORY,
        "Legal and Regulatory Agent",
        ("legal", "regulatory", "contract", "licence", "compliance"),
        "standard",
        "Identify legal and regulatory review needs without giving legal advice.",
    ),
    SpecialistAgent(
        AgentKey.POLICY_GOVERNANCE,
        "Internal Policy and Governance Agent",
        ("policy", "governance", "board", "approval", "risk appetite"),
        "standard",
        "Assess internal policy fit, governance ownership and approval controls.",
    ),
    SpecialistAgent(
        AgentKey.PRODUCT_UX,
        "Product and User Experience Agent",
        ("product", "ux", "user", "journey", "interface", "onboarding"),
        "basic",
        "Assess user workflow, usability and product risk.",
    ),
    SpecialistAgent(
        AgentKey.OPERATIONS_DELIVERY,
        "Operations and Delivery Agent",
        ("delivery", "operations", "launch", "rollout", "support", "runbook", "incident"),
        "standard",
        "Assess delivery, operational readiness and ownership.",
    ),
    SpecialistAgent(
        AgentKey.COMPARABLE_PRODUCTS_RESEARCH,
        "Comparable Products and External Research Agent",
        ("market", "competitor", "research", "benchmark", "comparable"),
        "standard",
        "Compare external precedents and market evidence.",
    ),
    SpecialistAgent(
        AgentKey.PHYSICAL_SYSTEMS,
        "Physical and Systems Engineering Agent",
        ("hardware", "systems", "physical", "safety case"),
        "in_depth",
        "Assess physical-system constraints and engineering safety assumptions.",
    ),
    SpecialistAgent(
        AgentKey.MATH_STATISTICS,
        "Mathematics and Statistics Agent",
        ("statistics", "math", "metric", "sample", "forecast", "probability"),
        "standard",
        "Assess quantitative reasoning, metrics and uncertainty.",
    ),
    SpecialistAgent(
        AgentKey.MEDICAL_CLINICAL,
        "Medical and Clinical Safety Agent",
        ("medical", "clinical", "health", "patient", "diagnosis", "treatment"),
        "in_depth",
        "Flag medical or clinical safety review needs without giving medical advice.",
    ),
    SpecialistAgent(
        AgentKey.LANGUAGE_CLARITY,
        "Language, Grammar and Clarity Agent",
        ("essay", "language", "clarity", "writing", "copy", "recipe", "instructions"),
        "basic",
        "Improve clarity, ambiguity and reader comprehension.",
    ),
    SpecialistAgent(
        AgentKey.ETHICS_RESPONSIBLE_USE,
        "Ethics and Responsible Use Agent",
        ("ethics", "responsible", "harm", "fairness", "misuse"),
        "standard",
        "Assess ethical risks, misuse and responsible-use boundaries.",
    ),
    SpecialistAgent(
        AgentKey.INCLUSIVITY_ACCESSIBILITY,
        "Inclusivity, Accessibility and Human Factors Agent",
        ("accessibility", "inclusive", "wcag", "human factors", "disability"),
        "standard",
        "Assess accessibility, inclusion and human-factor concerns.",
        knowledge_refs=("wcag-22",),
    ),
    SpecialistAgent(
        AgentKey.COMMERCIAL_FINANCIAL,
        "Commercial and Financial Agent",
        ("commercial", "financial", "finance", "budget", "pricing", "cost", "revenue"),
        "standard",
        "Assess commercial assumptions, costs and financial exposure.",
    ),
    SpecialistAgent(
        AgentKey.DATA_AI,
        "Data and AI Agent",
        ("data", "ai", "model", "dataset", "ml", "llm", "analytics"),
        "standard",
        "Assess data, model and AI-system risks.",
    ),
    SpecialistAgent(
        AgentKey.FUTURE_SECOND_ORDER,
        "Future Development and Second-Order Effects Agent",
        ("future", "second-order", "long term", "downstream", "unintended"),
        "in_depth",
        "Explore downstream and second-order consequences.",
    ),
    SpecialistAgent(
        AgentKey.ENVIRONMENTAL_SUSTAINABILITY,
        "Environmental and Sustainability Agent",
        ("environment", "sustainability", "carbon", "energy", "climate"),
        "in_depth",
        "Assess environmental and sustainability impacts.",
    ),
    SpecialistAgent(
        AgentKey.REPUTATION_STAKEHOLDER,
        "Reputation, Communications and Stakeholder Agent",
        ("reputation", "stakeholder", "press", "communications", "trust"),
        "standard",
        "Assess stakeholder, communications and reputational risk.",
    ),
    SpecialistAgent(
        AgentKey.FOOD_CONSUMER_SAFETY,
        "Food and Consumer Safety Agent",
        ("recipe", "food", "cooking", "ingredient", "allergen", "kitchen"),
        "basic",
        "Assess practical food, allergen and consumer-safety considerations.",
    ),
    SpecialistAgent(
        AgentKey.SOURCE_PROVENANCE,
        "Source Provenance Agent",
        ("source provenance", "citation quality", "evidence quality"),
        "basic",
        "Check source reliability, locator quality and prompt-injection boundaries.",
        knowledge_refs=("source-trust-policy", "prompt-injection-defences"),
        stage="assurance",
        default_select=True,
        output_schema="assurance_output",
    ),
    SpecialistAgent(
        AgentKey.QUALITY_FACT_CHECKER,
        "Quality and Fact Checker",
        ("quality gate", "fact check", "unsupported claim"),
        "basic",
        "Verify claims, recommendations, evidence labels and severity calibration before reporting.",
        knowledge_refs=("report-quality-gate", "claim-verification-rubric"),
        stage="assurance",
        default_select=True,
        output_schema="assurance_output",
    ),
)

AGENT_BY_KEY = {agent.key: agent for agent in SPECIALIST_REGISTRY}
AGENT_LABELS = {agent.key: agent.label for agent in SPECIALIST_REGISTRY}
SPECIALIST_AGENT_KEYS = tuple(agent.key for agent in SPECIALIST_REGISTRY if agent.stage == "specialist")
ASSURANCE_AGENT_KEYS = tuple(agent.key for agent in SPECIALIST_REGISTRY if agent.stage == "assurance")
