from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from app.application.agent_plan import routing_plan_payload
from app.application.ports.repositories import RepositoryPorts
from app.application.provenance import context_pack_snapshot
from app.application.provider_governance import ProviderGovernanceService
from app.application.report_assurance import enforce_quality_gate, quality_assurance_record
from app.application.report_composer import compose_report
from app.application.usage_policy import UsagePolicy
from app.application.workflow_retry import retry_policy_snapshot
from app.domain.enums import ReviewMode, RunState, WorkspaceRole
from app.domain.exceptions import AuthorisationError, NotFoundError, QualityGateError, RateLimitExceeded
from app.domain.policies import require_write, route_agents

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
    def __init__(
        self,
        repo: RepositoryPorts,
        registry: Any,
        governance: ProviderGovernanceService | None = None,
        usage_policy: UsagePolicy | None = None,
    ) -> None:
        self.repo = repo
        self.registry = registry
        self.governance = governance
        self.usage_policy = usage_policy or UsagePolicy()

    def start_run(self, user_id: str, review_id: str, *, execute_immediately: bool = True) -> Any:
        user = self._require_user(user_id)
        review = self._require_review(user_id, review_id)
        self._enforce_workflow_quota(user)
        source_types = [source.content_type for source in self.repo.list_sources(review.id)]
        decision = route_agents(
            ReviewMode(review.mode),
            review.focus_chips,
            review.title,
            review.proposal_text,
            source_types,
        )
        selected_agents = [agent.value for agent in decision.selected_agents]
        context_agent_keys = {
            agent.value
            for agent in [*decision.selected_agents, *decision.assurance_agents]
        }
        context_packs = context_pack_snapshot(
            self.repo.list_context_packs(review.workspace_id),
            context_agent_keys,
        )
        routing_metadata = self._routing_metadata(review, selected_agents)
        self._validate_governance(review.workspace_id, user_id)
        routing_plan = routing_plan_payload(decision, context_packs, routing_metadata)
        routing_plan["retry_policy"] = retry_policy_snapshot()
        run = self.repo.create_run(review.workspace_id, review.id, routing_plan, user_id)
        self.repo.add_run_event(run.id, RunState.INTAKE.value, "Run queued for background execution.")
        self.repo.audit(review.workspace_id, user_id, "run.started", {"run_id": run.id})
        self.repo.commit()
        if execute_immediately:
            return self.execute_run(run.id)
        return self.repo.get_run(run.id)

    def usage_limits(self, user_id: str) -> dict[str, Any]:
        user = self._require_user(user_id)
        quota = self.usage_policy.quota_for(getattr(user, "account_type", "user"))
        week_start = self._week_start()
        projects_used = self.repo.count_user_projects(user_id)
        workflows_used = self.repo.count_user_workflows(user_id)
        workflows_started_this_week = self.repo.count_user_workflow_creations_since(user_id, week_start)
        weekly_remaining = quota.remaining_weekly_workflows(workflows_started_this_week)
        return {
            "account_type": quota.account_type,
            "tier_name": quota.tier_name,
            "project_limit": quota.project_limit,
            "projects_used": projects_used,
            "projects_remaining": quota.remaining_projects(projects_used),
            "workflow_total_limit": quota.workflow_total_limit,
            "workflows_used": workflows_used,
            "workflows_remaining": quota.remaining_workflows(workflows_used),
            "workflow_weekly_limit": quota.workflow_weekly_limit,
            "workflows_started_this_week": workflows_started_this_week,
            "weekly_workflows_remaining": weekly_remaining,
            "resets_at": week_start + timedelta(days=7),
            "daily_review_run_limit": quota.workflow_weekly_limit,
            "runs_started_today": workflows_started_this_week,
            "runs_remaining_today": weekly_remaining,
        }

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
        try:
            provider = self.registry.get("fake")
        except KeyError:
            self.repo.update_run(run.id, RunState.FAILED.value)
            self.repo.add_run_event(run.id, RunState.FAILED.value, "No production AI provider is configured.")
            self.repo.commit()
            return self.repo.get_run(run.id)
        provider_output = provider.generate_structured(review.proposal_text, "specialist_output")
        if "claims" not in provider_output:
            self.repo.update_run(run.id, RunState.FAILED.value)
            self.repo.add_run_event(run.id, RunState.FAILED.value, "Provider output failed strict schema validation.")
            self.repo.commit()
            return self.repo.get_run(run.id)
        routing_plan = run.routing_plan if isinstance(run.routing_plan, dict) else {}
        report_data = compose_report(self.repo, review, run.id, routing_plan)
        report_data["quality_assurance"] = quality_assurance_record(report_data)
        try:
            enforce_quality_gate(report_data)
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

    def delete_workflow(self, user_id: str, run_id: str) -> None:
        run = self._require_run(user_id, run_id)
        self._require_write(user_id, run.workspace_id)
        self.repo.delete_run(run.id)
        self.repo.audit(run.workspace_id, user_id, "run.deleted", {"run_id": run.id})
        self.repo.commit()

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

    def _validate_governance(self, workspace_id: str, actor_user_id: str) -> None:
        if self.governance is None:
            return
        self.governance.validate_route(
            workspace_id,
            "fake",
            "fake-local",
            "internal",
            "global",
            "review",
            actor_user_id,
        )

    def _enforce_workflow_quota(self, user: Any) -> None:
        user_id = str(user.id)
        quota = self.usage_policy.quota_for(getattr(user, "account_type", "user"))
        workflows_used = self.repo.count_user_workflows(user_id)
        if quota.workflow_total_limit is not None and workflows_used >= quota.workflow_total_limit:
            raise RateLimitExceeded(
                f"{quota.tier_name} workflow storage limit reached ({quota.workflow_total_limit}). "
                "Delete an unused workflow before creating another."
            )
        weekly_used = self.repo.count_user_workflow_creations_since(user_id, self._week_start())
        if quota.workflow_weekly_limit is not None and weekly_used >= quota.workflow_weekly_limit:
            raise RateLimitExceeded(
                f"{quota.tier_name} weekly workflow limit reached ({quota.workflow_weekly_limit}). "
                "Wait until the weekly allowance resets before starting another workflow."
            )

    @staticmethod
    def _week_start() -> datetime:
        now = datetime.now(UTC)
        start = now - timedelta(days=now.weekday())
        return start.replace(hour=0, minute=0, second=0, microsecond=0)

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

    def _require_user(self, user_id: str) -> Any:
        user = self.repo.get_user(user_id)
        if user is None:
            raise AuthorisationError("Workspace access denied.")
        return user

    def _require_member(self, user_id: str, workspace_id: str) -> None:
        if self.repo.membership_role(workspace_id, user_id) is None:
            raise AuthorisationError("Workspace access denied.")

    def _require_write(self, user_id: str, workspace_id: str) -> None:
        role = self.repo.membership_role(workspace_id, user_id)
        if role is None:
            raise AuthorisationError("Workspace access denied.")
        require_write(WorkspaceRole(role))

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
