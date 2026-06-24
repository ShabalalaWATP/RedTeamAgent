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


AGENT_LABELS: dict[AgentKey, str] = {
    AgentKey.EVIDENCE_CONTEXT: "Evidence and Context Agent",
    AgentKey.ALTERNATIVE_PERSPECTIVES: "Alternative Perspectives Agent",
    AgentKey.SOFTWARE_ARCHITECTURE: "Software Architecture and Quality Agent",
    AgentKey.CYBERSECURITY_PRIVACY: "Cybersecurity and Privacy Agent",
    AgentKey.LEGAL_REGULATORY: "Legal and Regulatory Agent",
    AgentKey.POLICY_GOVERNANCE: "Internal Policy and Governance Agent",
    AgentKey.PRODUCT_UX: "Product and User Experience Agent",
    AgentKey.OPERATIONS_DELIVERY: "Operations and Delivery Agent",
}
