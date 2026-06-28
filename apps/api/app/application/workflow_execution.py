from __future__ import annotations

from typing import Any

from app.application.llm_agents import (
    agent_cards,
    build_agent_prompt,
    combined_agent_output,
    llm_claims,
    normalise_agent_output,
    selected_agent_keys,
)
from app.application.model_routing import ModelRoute, select_model_route
from app.application.ports.credentials import CredentialVault
from app.application.ports.repositories import RepositoryPorts
from app.application.report_assurance import enforce_quality_gate, quality_assurance_record
from app.application.report_composer import compose_report
from app.domain.enums import RunState, SourceState
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

        if self._is_cancelled(run.id):
            return self.repo.get_run(run.id)
        if not self._evidence_ready(review):
            return self._fail(run.id, "Attached evidence is not ready for LLM review. Re-ingest or remove it first.")
        self._advance(run.id, RunState.INGESTION)
        if self._is_cancelled(run.id):
            return self.repo.get_run(run.id)
        routing_plan = run.routing_plan if isinstance(run.routing_plan, dict) else {}
        route = select_model_route(self.repo, review.workspace_id, selected_agent_keys(run.routing_plan))
        try:
            provider, provider_config, credentials, model_identifier = self._provider_context(route)
        except (KeyError, ValueError):
            return self._fail(run.id, "Configure and verify a production AI provider before running a review.")
        self._advance(run.id, RunState.FRAMING)
        self._advance(run.id, RunState.AGENT_PLANNING)
        self._advance(run.id, RunState.SPECIALIST_REVIEW)
        try:
            provider_output = self._run_specialist_agents(
                run.id,
                provider,
                provider_config,
                credentials,
                model_identifier,
                review,
                routing_plan,
            )
        except ValueError as exc:
            return self._fail(run.id, str(exc))
        except Exception:
            return self._fail(run.id, "Provider request failed while running LLM agents. Check saved AI settings.")
        if not llm_claims(provider_output):
            return self._fail(run.id, "Provider output failed strict schema validation.")
        self._advance(run.id, RunState.RECONCILIATION)
        report_data = compose_report(self.repo, review, run.id, routing_plan, provider_output)
        self._advance(run.id, RunState.REPORT_COMPOSITION)
        report_data["quality_assurance"] = quality_assurance_record(report_data)
        try:
            enforce_quality_gate(report_data)
        except QualityGateError:
            return self._fail(run.id, "Report failed evidence quality gate.")
        self._advance(run.id, RunState.QUALITY_GATE)
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

    def _run_specialist_agents(
        self,
        run_id: str,
        provider: Any,
        provider_config: dict[str, Any],
        credentials: dict[str, str],
        model_identifier: str | None,
        review: Any,
        routing_plan: dict[str, Any],
    ) -> dict[str, Any]:
        outputs: list[dict[str, Any]] = []
        for card in agent_cards(routing_plan):
            prompt = build_agent_prompt(self.repo, review, routing_plan, card)
            raw_output = provider.generate_structured(
                prompt,
                str(card.get("output_schema", "specialist_output")),
                provider_config,
                credentials,
                model_identifier,
            )
            output = normalise_agent_output(card, raw_output)
            if not output["claims"]:
                label = str(card.get("label", card["key"]))
                raise ValueError(f"{label} returned no usable LLM claims. The review was not completed.")
            outputs.append(output)
            self.repo.add_run_event(
                run_id,
                RunState.SPECIALIST_REVIEW.value,
                f"{output['label']} returned {len(output['claims'])} usable LLM claim(s).",
            )
            self.repo.commit()
        return combined_agent_output(outputs)

    def _is_cancelled(self, run_id: str) -> bool:
        run = self.repo.get_run(run_id)
        return run is not None and run.state == RunState.CANCELLED.value

    def _advance(self, run_id: str, stage: RunState) -> None:
        self.repo.update_run(run_id, stage.value)
        self.repo.add_run_event(run_id, stage.value, self._message(stage))
        self.repo.commit()

    def _fail(self, run_id: str, message: str) -> Any:
        self.repo.update_run(run_id, RunState.FAILED.value)
        self.repo.add_run_event(run_id, RunState.FAILED.value, message)
        self.repo.commit()
        return self.repo.get_run(run_id)

    def _evidence_ready(self, review: Any) -> bool:
        sources = self.repo.list_sources(review.id)
        return all(source.state == SourceState.INGESTED.value for source in sources)

    @staticmethod
    def _message(stage: RunState) -> str:
        return {
            RunState.INTAKE: "Review intake validated.",
            RunState.INGESTION: "Evidence sources are ingested and ready for LLM review.",
            RunState.FRAMING: "Review frame prepared from proposal, mode and focus chips.",
            RunState.AGENT_PLANNING: "Relevant agents selected and model route confirmed.",
            RunState.SPECIALIST_REVIEW: "Ingested evidence sent to the configured LLM for specialist review.",
            RunState.RECONCILIATION: "LLM findings reconciled against retrieved evidence.",
            RunState.REPORT_COMPOSITION: "Structured report composed from LLM-checked evidence.",
            RunState.QUALITY_GATE: "Evidence and unsupported-claim quality gate passed.",
        }[stage]


def _usage(route: ModelRoute | None) -> dict[str, Any]:
    if route is None:
        return {"provider": "fake", "model_identifier": "fake-local", "tokens": 0}
    return {**route.metadata(), "tokens": 0}
