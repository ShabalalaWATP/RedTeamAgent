from __future__ import annotations

from typing import Any

from app.application.model_routing import ModelRoute, select_model_route
from app.application.ports.credentials import CredentialVault
from app.application.ports.repositories import RepositoryPorts
from app.application.report_assurance import enforce_quality_gate, quality_assurance_record
from app.application.report_composer import compose_report
from app.domain.enums import RunState
from app.domain.exceptions import NotFoundError, QualityGateError

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


class WorkflowExecutor:
    def __init__(self, repo: RepositoryPorts, registry: Any, credential_vault: CredentialVault | None = None) -> None:
        self.repo = repo
        self.registry = registry
        self.credential_vault = credential_vault

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
        route = select_model_route(self.repo, review.workspace_id, _selected_agent_keys(run.routing_plan))
        try:
            provider, provider_config, credentials, model_identifier = self._provider_context(route)
        except (KeyError, ValueError):
            self.repo.update_run(run.id, RunState.FAILED.value)
            self.repo.add_run_event(run.id, RunState.FAILED.value, "No production AI provider is configured.")
            self.repo.commit()
            return self.repo.get_run(run.id)
        try:
            provider_output = provider.generate_structured(
                review.proposal_text,
                "specialist_output",
                provider_config,
                credentials,
                model_identifier,
            )
        except Exception:
            self.repo.update_run(run.id, RunState.FAILED.value)
            self.repo.add_run_event(run.id, RunState.FAILED.value, "Provider request failed. Check saved AI settings.")
            self.repo.commit()
            return self.repo.get_run(run.id)
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
        self.repo.update_run(run.id, RunState.COMPLETED.value, _usage(route))
        self.repo.add_run_event(run.id, RunState.COMPLETED.value, "Structured report passed quality gate.")
        self.repo.audit(review.workspace_id, actor_user_id, "run.completed", {"run_id": run.id})
        self.repo.commit()
        return self.repo.get_run(run.id)

    def _provider_context(self, route: ModelRoute | None) -> tuple[Any, dict[str, Any], dict[str, str], str | None]:
        if route is None:
            return self.registry.get("fake"), {}, {}, None
        if self.credential_vault is None:
            raise ValueError("Credential vault is required for saved provider routes.")
        return (
            self.registry.get(route.provider),
            route.config,
            self.credential_vault.unseal(route.encrypted_credentials),
            route.model_identifier,
        )

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


def _selected_agent_keys(routing_plan: Any) -> list[str]:
    if not isinstance(routing_plan, dict):
        return []
    agents = routing_plan.get("selected_agents", [])
    if not isinstance(agents, list):
        return []
    return [
        str(agent.get("key") if isinstance(agent, dict) else agent)
        for agent in agents
        if (isinstance(agent, dict) and agent.get("key")) or isinstance(agent, str)
    ]


def _usage(route: ModelRoute | None) -> dict[str, Any]:
    if route is None:
        return {"provider": "fake", "model_identifier": "fake-local", "tokens": 0}
    return {**route.metadata(), "tokens": 0}
