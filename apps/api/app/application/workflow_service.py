from __future__ import annotations

from typing import Any

from app.application.ports.credentials import CredentialVault
from app.application.ports.repositories import RepositoryPorts
from app.application.provider_governance import ProviderGovernanceService
from app.application.usage_policy import UsagePolicy
from app.application.workflow_execution import TERMINAL_STATES, WorkflowExecutor
from app.application.workflow_quota import WorkflowQuotaService
from app.application.workflow_routing import WorkflowRoutingPlanner
from app.domain.enums import RunState, WorkspaceRole
from app.domain.exceptions import AuthorisationError, NotFoundError
from app.domain.policies import require_write


class WorkflowService:
    def __init__(
        self,
        repo: RepositoryPorts,
        registry: Any,
        governance: ProviderGovernanceService | None = None,
        usage_policy: UsagePolicy | None = None,
        credential_vault: CredentialVault | None = None,
        allow_fake_provider: bool = True,
    ) -> None:
        self.repo = repo
        self.quota = WorkflowQuotaService(repo, usage_policy or UsagePolicy())
        self.routing = WorkflowRoutingPlanner(repo, governance, allow_fake_provider)
        self.executor = WorkflowExecutor(repo, registry, credential_vault)

    def start_run(self, user_id: str, review_id: str, *, execute_immediately: bool = True) -> Any:
        user = self._require_user(user_id)
        review = self._require_review(user_id, review_id)
        self._require_write(user_id, review.workspace_id)
        self.quota.enforce(user)
        routing_plan = self.routing.build_plan(review, user_id)
        run = self.repo.create_run(review.workspace_id, review.id, routing_plan, user_id)
        self.repo.add_run_event(run.id, RunState.INTAKE.value, "Run queued for background execution.")
        self.repo.audit(review.workspace_id, user_id, "run.started", {"run_id": run.id})
        self.repo.commit()
        if execute_immediately:
            return self.execute_run(run.id)
        return self.repo.get_run(run.id)

    def usage_limits(self, user_id: str) -> dict[str, Any]:
        return self.quota.usage_limits(self._require_user(user_id))

    def execute_run(self, run_id: str, actor_user_id: str | None = None) -> Any:
        return self.executor.execute_run(run_id, actor_user_id)

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
