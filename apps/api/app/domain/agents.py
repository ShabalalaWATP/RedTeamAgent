from __future__ import annotations

from dataclasses import dataclass

from app.domain.enums import AgentKey


@dataclass(frozen=True)
class SpecialistAgent:
    key: AgentKey
    label: str
    focus_terms: tuple[str, ...]
    minimum_mode: str


SPECIALIST_REGISTRY: tuple[SpecialistAgent, ...] = (
    SpecialistAgent(AgentKey.EVIDENCE_CONTEXT, "Evidence and Context Agent", ("evidence", "source"), "basic"),
    SpecialistAgent(AgentKey.ALTERNATIVE_PERSPECTIVES, "Alternative Perspectives Agent", ("alternative",), "standard"),
    SpecialistAgent(
        AgentKey.SOFTWARE_ARCHITECTURE,
        "Software Architecture and Quality Agent",
        ("code", "architecture"),
        "standard",
    ),
    SpecialistAgent(
        AgentKey.CYBERSECURITY_PRIVACY,
        "Cybersecurity and Privacy Agent",
        ("security", "privacy"),
        "basic",
    ),
    SpecialistAgent(AgentKey.LEGAL_REGULATORY, "Legal and Regulatory Agent", ("legal", "regulatory"), "standard"),
    SpecialistAgent(
        AgentKey.POLICY_GOVERNANCE,
        "Internal Policy and Governance Agent",
        ("policy", "governance"),
        "standard",
    ),
    SpecialistAgent(AgentKey.PRODUCT_UX, "Product and User Experience Agent", ("product", "ux", "user"), "basic"),
    SpecialistAgent(
        AgentKey.OPERATIONS_DELIVERY,
        "Operations and Delivery Agent",
        ("delivery", "operations"),
        "standard",
    ),
    SpecialistAgent(
        AgentKey.COMPARABLE_PRODUCTS_RESEARCH,
        "Comparable Products and External Research Agent",
        ("market", "competitor", "research"),
        "standard",
    ),
    SpecialistAgent(
        AgentKey.PHYSICAL_SYSTEMS,
        "Physical and Systems Engineering Agent",
        ("hardware", "systems", "physical"),
        "in_depth",
    ),
    SpecialistAgent(
        AgentKey.MATH_STATISTICS,
        "Mathematics and Statistics Agent",
        ("statistics", "math", "metric"),
        "standard",
    ),
    SpecialistAgent(
        AgentKey.MEDICAL_CLINICAL,
        "Medical and Clinical Safety Agent",
        ("medical", "clinical", "health"),
        "in_depth",
    ),
    SpecialistAgent(
        AgentKey.LANGUAGE_CLARITY,
        "Language, Grammar and Clarity Agent",
        ("essay", "language", "clarity"),
        "basic",
    ),
    SpecialistAgent(
        AgentKey.ETHICS_RESPONSIBLE_USE,
        "Ethics and Responsible Use Agent",
        ("ethics", "responsible"),
        "standard",
    ),
    SpecialistAgent(
        AgentKey.INCLUSIVITY_ACCESSIBILITY,
        "Inclusivity, Accessibility and Human Factors Agent",
        ("accessibility", "inclusive"),
        "standard",
    ),
    SpecialistAgent(
        AgentKey.COMMERCIAL_FINANCIAL,
        "Commercial and Financial Agent",
        ("commercial", "financial", "budget"),
        "standard",
    ),
    SpecialistAgent(AgentKey.DATA_AI, "Data and AI Agent", ("data", "ai", "model"), "standard"),
    SpecialistAgent(
        AgentKey.FUTURE_SECOND_ORDER,
        "Future Development and Second-Order Effects Agent",
        ("future", "second-order"),
        "in_depth",
    ),
    SpecialistAgent(
        AgentKey.ENVIRONMENTAL_SUSTAINABILITY,
        "Environmental and Sustainability Agent",
        ("environment", "sustainability"),
        "in_depth",
    ),
    SpecialistAgent(
        AgentKey.REPUTATION_STAKEHOLDER,
        "Reputation, Communications and Stakeholder Agent",
        ("reputation", "stakeholder"),
        "standard",
    ),
)

AGENT_LABELS = {agent.key: agent.label for agent in SPECIALIST_REGISTRY}
