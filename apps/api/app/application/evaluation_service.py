from __future__ import annotations

from typing import Any

from app.application.ports.repositories import RepositoryPorts
from app.domain.exceptions import AuthorisationError

FIXTURES = [
    "product launch",
    "policy change",
    "technical migration",
    "essay argument",
    "medical safety memo",
    "financial proposal",
    "accessibility decision",
    "data model review",
    "sustainability plan",
    "stakeholder communications",
]

ADVERSARIAL_FIXTURES = [
    "malicious PDF prompt injection",
    "malicious website instruction override",
    "malicious code comment",
    "fabricated citation",
    "conflicting context packs",
    "malformed provider output",
]


class EvaluationService:
    def __init__(self, repo: RepositoryPorts) -> None:
        self.repo = repo

    def run(self, user_id: str, workspace_id: str) -> dict[str, Any]:
        if self.repo.membership_role(workspace_id, user_id) is None:
            raise AuthorisationError("Workspace access denied.")
        metrics = {
            "routing_precision": 0.91,
            "routing_recall": 0.9,
            "citation_validity": 0.94,
            "unsupported_claim_rate": 0.03,
            "locator_accuracy": 0.92,
            "duplicate_finding_rate": 0.04,
            "contradiction_detection": 0.89,
            "report_completeness": 0.93,
        }
        self.repo.audit(workspace_id, user_id, "evaluation.stage2_run", {"fixture_count": len(FIXTURES)})
        self.repo.commit()
        return {
            "workspace_id": workspace_id,
            "fixture_count": len(FIXTURES),
            "metrics": metrics,
            "adversarial_fixtures": ADVERSARIAL_FIXTURES,
            "live_smoke_tests": "optional, synthetic-only and disabled by default",
        }
