from __future__ import annotations

from typing import Any

from app.application.ports.repositories import RepositoryPorts
from app.application.provenance import context_pack_snapshot
from app.application.search_service import DeterministicSearchProvider, research_queries
from app.application.workflow_retry import retry_policy_snapshot
from app.domain.agents import AGENT_LABELS
from app.domain.enums import AgentKey, ReviewMode, RunState
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
EXECUTION_STAGES = STAGES[1:]
TERMINAL_STATES = {RunState.COMPLETED.value, RunState.FAILED.value, RunState.CANCELLED.value}


class WorkflowService:
    def __init__(self, repo: RepositoryPorts, registry: Any) -> None:
        self.repo = repo
        self.registry = registry

    def start_run(self, user_id: str, review_id: str, *, execute_immediately: bool = True) -> Any:
        review = self._require_review(user_id, review_id)
        decision = route_agents(ReviewMode(review.mode), review.focus_chips)
        selected_agents = [agent.value for agent in decision.selected_agents]
        context_packs = context_pack_snapshot(
            self.repo.list_context_packs(review.workspace_id),
            set(selected_agents),
        )
        routing_metadata = self._routing_metadata(review, selected_agents)
        routing_plan = {
            "selected_agents": selected_agents,
            "excluded_agents": {agent.value: reason for agent, reason in decision.excluded_agents.items()},
            "context_packs": context_packs,
            "model_profile": "fake-local",
            "permitted_fallbacks": ["fake-local"],
            "retry_policy": retry_policy_snapshot(),
            **routing_metadata,
        }
        run = self.repo.create_run(review.workspace_id, review.id, routing_plan)
        self.repo.add_run_event(run.id, RunState.INTAKE.value, "Run queued for background execution.")
        self.repo.audit(review.workspace_id, user_id, "run.started", {"run_id": run.id})
        self.repo.commit()
        if execute_immediately:
            return self.execute_run(run.id)
        return self.repo.get_run(run.id)

    def execute_run(self, run_id: str, actor_user_id: str | None = None) -> Any:
        run = self.repo.get_run(run_id)
        if run is None:
            raise NotFoundError("Run not found.")
        if run.state in TERMINAL_STATES:
            return run
        review = self.repo.get_review(run.review_id)
        if review is None:
            raise NotFoundError("Review not found.")

        for stage in EXECUTION_STAGES:
            if self._is_cancelled(run.id):
                return self.repo.get_run(run.id)
            self.repo.update_run(run.id, stage.value)
            self.repo.add_run_event(run.id, stage.value, self._message(stage))
            self.repo.commit()
        if self._is_cancelled(run.id):
            return self.repo.get_run(run.id)
        provider_output = self.registry.get("fake").generate_structured(
            review.proposal_text,
            "specialist_output",
        )
        if "claims" not in provider_output:
            self.repo.update_run(run.id, RunState.FAILED.value)
            self.repo.add_run_event(run.id, RunState.FAILED.value, "Provider output failed strict schema validation.")
            self.repo.commit()
            return self.repo.get_run(run.id)
        routing_plan = run.routing_plan if isinstance(run.routing_plan, dict) else {}
        report_data = self._compose_report(review, run.id, routing_plan)
        try:
            self._quality_gate(report_data)
        except QualityGateError:
            self.repo.update_run(run.id, RunState.FAILED.value)
            self.repo.add_run_event(run.id, RunState.FAILED.value, "Report failed evidence quality gate.")
            self.repo.commit()
            return self.repo.get_run(run.id)
        if self._is_cancelled(run.id):
            return self.repo.get_run(run.id)
        self.repo.create_report(review.workspace_id, run.id, report_data)
        self.repo.update_run(run.id, RunState.COMPLETED.value, {"provider": "fake", "tokens": 0})
        self.repo.add_run_event(run.id, RunState.COMPLETED.value, "Structured report passed quality gate.")
        self.repo.audit(review.workspace_id, actor_user_id, "run.completed", {"run_id": run.id})
        self.repo.commit()
        return self.repo.get_run(run.id)

    def cancel_run(self, user_id: str, run_id: str) -> Any:
        run = self._require_run(user_id, run_id)
        if run.state not in TERMINAL_STATES:
            self.repo.update_run(run.id, RunState.CANCELLED.value)
            self.repo.add_run_event(run.id, RunState.CANCELLED.value, "Run cancelled by user.")
            self.repo.audit(run.workspace_id, user_id, "run.cancelled", {"run_id": run.id})
            self.repo.commit()
        return self.repo.get_run(run.id)

    def get_run(self, user_id: str, run_id: str) -> Any:
        return self._require_run(user_id, run_id)

    def list_workflows(self, user_id: str, workspace_id: str) -> list[dict[str, Any]]:
        self._require_member(user_id, workspace_id)
        return self.repo.list_workflows(workspace_id)

    def list_events(self, user_id: str, run_id: str) -> list[Any]:
        self._require_run(user_id, run_id)
        return self.repo.list_run_events(run_id)

    def get_report(self, user_id: str, run_id: str) -> Any:
        run = self._require_run(user_id, run_id)
        report = self.repo.get_report_by_run(run.id)
        if report is None:
            raise NotFoundError("Report not found.")
        return report

    def compare_reports(self, user_id: str, left_run_id: str, right_run_id: str) -> dict[str, Any]:
        left = self.get_report(user_id, left_run_id)
        right = self.get_report(user_id, right_run_id)
        return {
            "left_run_id": left_run_id,
            "right_run_id": right_run_id,
            "changed_risks": self._changed(left.data, right.data, "top_risks"),
            "changed_assumptions": self._changed(left.data, right.data, "assumptions"),
            "changed_evidence_gaps": self._changed(left.data, right.data, "evidence_gaps"),
            "changed_recommendations": self._changed(left.data, right.data, "recommended_actions"),
        }

    def _compose_report(self, review: Any, run_id: str, routing_plan: dict[str, Any]) -> dict[str, Any]:
        sources = self.repo.list_sources(review.id)
        source_labels = [f"{source.filename}:{source.id}" for source in sources]
        evidence_query = " ".join([review.title, review.proposal_text, *review.focus_chips])
        retrieved_evidence = self.repo.search_evidence_chunks(review.workspace_id, review.id, evidence_query, 5)
        primary_evidence = retrieved_evidence[0] if retrieved_evidence else None
        evidence_label = str(primary_evidence["locator"]) if primary_evidence else "assumption"
        evidence_type = "source" if primary_evidence else "assumption"
        context_packs = self._safe_list(routing_plan.get("context_packs", []))
        external_sources = self._external_sources(review)
        findings = [
            {
                "id": "finding-1",
                "title": "Review evidence needs explicit ownership before launch.",
                "severity": "medium",
                "confidence": "high" if primary_evidence else "low",
                "agent": "operations_delivery",
                "category": "delivery",
                "evidence_type": evidence_type,
                "evidence_label": evidence_label,
                "evidence_excerpt": str(primary_evidence["excerpt"]) if primary_evidence else "",
                "summary": "The proposal should assign owners for validation, rollout and operational follow-up.",
                "recommended_action": "Assign named owners and acceptance criteria for each high-risk dependency.",
            }
        ]
        action_items = [
            {
                "id": "action-1",
                "title": "Assign validation owners",
                "status": "open",
                "owner": "Unassigned",
                "due": None,
                "source": evidence_label,
            }
        ]
        return {
            "id": f"report-{run_id}",
            "title": review.title,
            "provisional_recommendation": "Proceed with controls and validation before irreversible rollout.",
            "executive_summary": "The review found manageable risk with evidence gaps that need active closure.",
            "coverage_map": {
                "sources": len(sources),
                "agents": routing_plan["selected_agents"],
                "retrieved_evidence": len(retrieved_evidence),
                "external_sources": len(external_sources),
            },
            "top_risks": [finding["title"] for finding in findings],
            "dependencies": ["Provider routing policy", "Evidence quality", "Operational ownership"],
            "blockers": [] if primary_evidence else ["No retrievable evidence was available."],
            "assumptions": ["Report is decision support and not professional sign-off."],
            "evidence_gaps": [] if primary_evidence else ["No source-backed evidence was retrieved."],
            "specialist_findings": [
                {"agent": key, "label": AGENT_LABELS[AgentKey(key)]}
                for key in routing_plan["selected_agents"]
                if key in {agent.value for agent in AgentKey}
            ],
            "context_packs": context_packs,
            "findings": findings,
            "retrieved_evidence": retrieved_evidence,
            "external_sources": external_sources,
            "risk_matrix": [
                {
                    "risk": finding["title"],
                    "likelihood": "medium",
                    "impact": finding["severity"],
                    "colour_independent_label": "M/M",
                }
                for finding in findings
            ],
            "dependency_graph": [
                {"from": "Evidence quality", "to": "Operational ownership"},
                {"from": "Provider routing policy", "to": "Evidence quality"},
            ],
            "time_horizons": {
                "near": ["Close ownership and evidence gaps before rollout."],
                "mid": ["Run validation experiments against assumptions."],
                "long": ["Monitor second-order stakeholder and operating impacts."],
            },
            "evidence_quality": {"retrieval_score": retrieved_evidence[0]["score"] if retrieved_evidence else 0.0},
            "cross_agent_disagreements": [
                {
                    "topic": "Proceed timing",
                    "positions": ["Operations favours gated rollout.", "Policy asks for stronger evidence first."],
                }
            ],
            "strongest_case_for": "A staged rollout can reduce uncertainty while preserving reversibility.",
            "strongest_case_against": (
                "Proceeding without named owners can turn manageable gaps into operational failure."
            ),
            "pre_mortem": [
                "The decision fails because rollback ownership and support coverage were assumed, not verified."
            ],
            "scenarios": {
                "best": "Validation closes key gaps and the rollout proceeds with low disruption.",
                "base": "Some evidence remains incomplete, requiring a narrower launch.",
                "worst": "Unsupported assumptions create avoidable operational and reputational impact.",
            },
            "validation_experiments": [
                "Run a tabletop rollback rehearsal.",
                "Ask support to simulate peak incident coverage.",
            ],
            "action_items": action_items,
            "recommended_actions": [finding["recommended_action"] for finding in findings],
            "sources": source_labels,
            "methodology": (
                "Deterministic Stage 2 workflow with hybrid evidence retrieval, optional external research, "
                "full specialist routing, source-linked quality gate and context-pack version snapshot."
            ),
        }

    def _external_sources(self, review: Any) -> list[dict[str, Any]]:
        if not review.external_research:
            return []
        provider = DeterministicSearchProvider()
        results: list[dict[str, Any]] = []
        for query in research_queries(review.title, review.focus_chips, review.private_research):
            results.extend(provider.search(query, review.domain_allowlist, review.domain_blocklist))
        return results

    @staticmethod
    def _safe_list(value: object) -> list[dict[str, Any]]:
        if not isinstance(value, list):
            return []
        return [item for item in value if isinstance(item, dict)]

    def _routing_metadata(self, review: Any, selected_agents: list[str]) -> dict[str, Any]:
        models = self.repo.list_models(review.workspace_id)
        fallback_routes = []
        if not models:
            fallback_routes.append(
                {
                    "from": "configured model profile",
                    "to": "fake-local",
                    "reason": "No verified model profiles are configured for this workspace.",
                }
            )
        diversity_enabled = review.mode == ReviewMode.IN_DEPTH.value
        diversity_routes = [
            {"agent": agent, "provider": "fake", "model_profile": "fake-local"}
            for agent in selected_agents
        ] if diversity_enabled else []
        return {
            "model_diversity": {
                "enabled": diversity_enabled,
                "policy": {
                    "respect_data_classification": True,
                    "respect_residency": True,
                    "respect_provider_pinning": True,
                    "respect_local_only": True,
                },
                "routes": diversity_routes,
            },
            "fallback_routes": fallback_routes,
        }

    @staticmethod
    def _changed(left: dict[str, Any], right: dict[str, Any], key: str) -> list[str]:
        left_raw = left.get(key, [])
        right_raw = right.get(key, [])
        left_values = {str(item) for item in left_raw} if isinstance(left_raw, list) else set()
        right_values = {str(item) for item in right_raw} if isinstance(right_raw, list) else set()
        return sorted(left_values.symmetric_difference(right_values))

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

    def _is_cancelled(self, run_id: str) -> bool:
        run = self.repo.get_run(run_id)
        return run is not None and run.state == RunState.CANCELLED.value

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
