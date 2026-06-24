from __future__ import annotations

from enum import StrEnum


class WorkspaceRole(StrEnum):
    OWNER = "owner"
    ADMINISTRATOR = "administrator"
    MEMBER = "member"
    VIEWER = "viewer"


class ReviewMode(StrEnum):
    BASIC = "basic"
    STANDARD = "standard"
    IN_DEPTH = "in_depth"


class SourceState(StrEnum):
    PENDING = "pending"
    INGESTED = "ingested"
    FAILED = "failed"


class RunState(StrEnum):
    INTAKE = "intake"
    INGESTION = "ingestion"
    FRAMING = "framing"
    AGENT_PLANNING = "agent_planning"
    SPECIALIST_REVIEW = "specialist_review"
    RECONCILIATION = "reconciliation"
    REPORT_COMPOSITION = "report_composition"
    QUALITY_GATE = "quality_gate"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AgentKey(StrEnum):
    EVIDENCE_CONTEXT = "evidence_context"
    ALTERNATIVE_PERSPECTIVES = "alternative_perspectives"
    SOFTWARE_ARCHITECTURE = "software_architecture"
    CYBERSECURITY_PRIVACY = "cybersecurity_privacy"
    LEGAL_REGULATORY = "legal_regulatory"
    POLICY_GOVERNANCE = "policy_governance"
    PRODUCT_UX = "product_ux"
    OPERATIONS_DELIVERY = "operations_delivery"
    COMPARABLE_PRODUCTS_RESEARCH = "comparable_products_research"
    PHYSICAL_SYSTEMS = "physical_systems"
    MATH_STATISTICS = "math_statistics"
    MEDICAL_CLINICAL = "medical_clinical"
    LANGUAGE_CLARITY = "language_clarity"
    ETHICS_RESPONSIBLE_USE = "ethics_responsible_use"
    INCLUSIVITY_ACCESSIBILITY = "inclusivity_accessibility"
    COMMERCIAL_FINANCIAL = "commercial_financial"
    DATA_AI = "data_ai"
    FUTURE_SECOND_ORDER = "future_second_order"
    ENVIRONMENTAL_SUSTAINABILITY = "environmental_sustainability"
    REPUTATION_STAKEHOLDER = "reputation_stakeholder"
