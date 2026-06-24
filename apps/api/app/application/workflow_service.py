from __future__ import annotations

from typing import Any

from app.application.ports.repositories import RepositoryPorts
from app.domain.enums import AGENT_LABELS, AgentKey, ReviewMode, RunState
from app.domain.exceptions import AuthorisationError, NotFoundError, QualityGateError
from app.domain.policies import route_agents

STAGES = [
    RunState.INTAKE,
    RunState.INGESTION,
    RunState.FRAMING,
    RunState.AGENT_PLANNING,
    RunState.SPECIALIST_REVIEW,
    RunState.RECONCILIATION,
    RunState.REPORT_COMPOSITION,
    RunState.QUALITY_GATE,
]


class WorkflowService:
    def __init__(self, repo: RepositoryPorts, registry: Any) -> None:
        self.repo = repo
        self.registry = registry

    def start_run(self, user_id: str, review_id: str) -> Any:
        review = self._require_review(user_id, review_id)
        decision = route_agents(ReviewMode(review.mode), review.focus_chips)
        routing_plan = {
            "selected_agents": [agent.value for agent in decision.selected_agents],
            "excluded_agents": {agent.value: reason for agent, reason in decision.excluded_agents.items()},
            "model_profile": "fake-local",
            "permitted_fallbacks": ["fake-local"],
        }
        run = self.repo.create_run(review.workspace_id, review.id, routing_plan)
        for stage in STAGES:
            self.repo.update_run(run.id, stage.value)
            self.repo.add_run_event(run.id, stage.value, self._message(stage))
        provider_output = self.registry.get("fake").generate_structured(
            review.proposal_text,
            "specialist_output",
        )
        if "claims" not in provider_output:
            self.repo.update_run(run.id, RunState.FAILED.value)
            self.repo.add_run_event(run.id, RunState.FAILED.value, "Provider output failed strict schema validation.")
            self.repo.commit()
            raise QualityGateError("Invalid structured provider output.")
        report_data = self._compose_report(review, run.id, routing_plan)
        self._quality_gate(report_data)
        self.repo.create_report(review.workspace_id, run.id, report_data)
        self.repo.update_run(run.id, RunState.COMPLETED.value, {"provider": "fake", "tokens": 0})
        self.repo.add_run_event(run.id, RunState.COMPLETED.value, "Structured report passed quality gate.")
        self.repo.audit(review.workspace_id, user_id, "run.completed", {"run_id": run.id})
        self.repo.commit()
        return self.repo.get_run(run.id)

    def cancel_run(self, user_id: str, run_id: str) -> Any:
        run = self._require_run(user_id, run_id)
        if run.state not in {RunState.COMPLETED.value, RunState.FAILED.value}:
            self.repo.update_run(run.id, RunState.CANCELLED.value)
            self.repo.add_run_event(run.id, RunState.CANCELLED.value, "Run cancelled by user.")
            self.repo.commit()
        return self.repo.get_run(run.id)

    def get_run(self, user_id: str, run_id: str) -> Any:
        return self._require_run(user_id, run_id)

    def list_events(self, user_id: str, run_id: str) -> list[Any]:
        self._require_run(user_id, run_id)
        return self.repo.list_run_events(run_id)

    def get_report(self, user_id: str, run_id: str) -> Any:
        run = self._require_run(user_id, run_id)
        report = self.repo.get_report_by_run(run.id)
        if report is None:
            raise NotFoundError("Report not found.")
        return report

    def _compose_report(self, review: Any, run_id: str, routing_plan: dict[str, Any]) -> dict[str, Any]:
        sources = self.repo.list_sources(review.id)
        source_labels = [f"{source.filename}:{source.id}" for source in sources]
        evidence_label = source_labels[0] if source_labels else "assumption"
        findings = [
            {
                "id": "finding-1",
                "title": "Review evidence needs explicit ownership before launch.",
                "severity": "medium",
                "confidence": "high" if sources else "low",
                "agent": "operations_delivery",
                "category": "delivery",
                "evidence_type": "source" if sources else "assumption",
                "evidence_label": evidence_label,
                "summary": "The proposal should assign owners for validation, rollout and operational follow-up.",
                "recommended_action": "Assign named owners and acceptance criteria for each high-risk dependency.",
            }
        ]
        return {
            "id": f"report-{run_id}",
            "title": review.title,
            "provisional_recommendation": "Proceed with controls and validation before irreversible rollout.",
            "executive_summary": "The review found manageable risk with evidence gaps that need active closure.",
            "coverage_map": {"sources": len(sources), "agents": routing_plan["selected_agents"]},
            "top_risks": [finding["title"] for finding in findings],
            "dependencies": ["Provider routing policy", "Evidence quality", "Operational ownership"],
            "blockers": [] if sources else ["No ingested evidence was available."],
            "assumptions": ["Report is decision support and not professional sign-off."],
            "evidence_gaps": [] if sources else ["No source-backed evidence was ingested."],
            "specialist_findings": [
                {"agent": key, "label": AGENT_LABELS[AgentKey(key)]}
                for key in routing_plan["selected_agents"]
                if key in {agent.value for agent in AgentKey}
            ],
            "findings": findings,
            "recommended_actions": [finding["recommended_action"] for finding in findings],
            "sources": source_labels,
            "methodology": "Deterministic fake-provider Stage 1 workflow with source-linked quality gate.",
        }

    @staticmethod
    def _quality_gate(report_data: dict[str, Any]) -> None:
        for finding in report_data.get("findings", []):
            if finding.get("evidence_type") not in {"source", "inference", "assumption", "unknown"}:
                raise QualityGateError("Finding evidence type is not supported.")
            if finding.get("evidence_type") == "source" and not finding.get("evidence_label"):
                raise QualityGateError("Source-backed finding is missing a locator.")

    def _require_run(self, user_id: str, run_id: str) -> Any:
        run = self.repo.get_run(run_id)
        if run is None:
            raise NotFoundError("Run not found.")
        self._require_member(user_id, run.workspace_id)
        return run

    def _require_review(self, user_id: str, review_id: str) -> Any:
        review = self.repo.get_review(review_id)
        if review is None:
            raise NotFoundError("Review not found.")
        self._require_member(user_id, review.workspace_id)
        return review

    def _require_member(self, user_id: str, workspace_id: str) -> None:
        if self.repo.membership_role(workspace_id, user_id) is None:
            raise AuthorisationError("Workspace access denied.")

    @staticmethod
    def _message(stage: RunState) -> str:
        return {
            RunState.INTAKE: "Review intake validated.",
            RunState.INGESTION: "Evidence sources checked.",
            RunState.FRAMING: "Review frame and assumptions prepared.",
            RunState.AGENT_PLANNING: "Relevant agents selected and exclusions recorded.",
            RunState.SPECIALIST_REVIEW: "Specialist review outputs validated.",
            RunState.RECONCILIATION: "Cross-agent findings reconciled.",
            RunState.REPORT_COMPOSITION: "Structured report composed.",
            RunState.QUALITY_GATE: "Evidence and unsupported-claim quality gate executed.",
        }[stage]
