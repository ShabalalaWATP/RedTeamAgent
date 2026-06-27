from __future__ import annotations

from typing import Any

from app.application.agent_plan import routing_plan_payload
from app.application.provenance import context_pack_snapshot
from app.application.provider_governance import ProviderGovernanceService
from app.application.workflow_retry import retry_policy_snapshot
from app.domain.enums import ReviewMode
from app.domain.policies import route_agents


class WorkflowRoutingPlanner:
    def __init__(self, repo: Any, governance: ProviderGovernanceService | None = None) -> None:
        self.repo = repo
        self.governance = governance

    def build_plan(self, review: Any, actor_user_id: str) -> dict[str, Any]:
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
        self._validate_governance(review.workspace_id, actor_user_id)
        plan = routing_plan_payload(decision, context_packs, self._routing_metadata(review, selected_agents))
        plan["retry_policy"] = retry_policy_snapshot()
        return plan

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
