from __future__ import annotations

from typing import Any

from app.application.agent_plan import routing_plan_payload
from app.application.model_routing import select_model_route
from app.application.provenance import context_pack_snapshot
from app.application.provider_governance import ProviderGovernanceService
from app.application.workflow_retry import retry_policy_snapshot
from app.domain.enums import ReviewMode
from app.domain.policies import route_agents


class WorkflowRoutingPlanner:
    def __init__(
        self,
        repo: Any,
        governance: ProviderGovernanceService | None = None,
        allow_fake_provider: bool = True,
    ) -> None:
        self.repo = repo
        self.governance = governance
        self.allow_fake_provider = allow_fake_provider

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
        self._validate_governance(review.workspace_id, actor_user_id, selected_agents)
        plan = routing_plan_payload(decision, context_packs, self._routing_metadata(review, selected_agents))
        plan["retry_policy"] = retry_policy_snapshot()
        return plan

    def _validate_governance(self, workspace_id: str, actor_user_id: str, selected_agents: list[str]) -> None:
        if self.governance is None:
            return
        route = select_model_route(self.repo, workspace_id, selected_agents)
        if route is not None:
            self.governance.validate_route(
                workspace_id,
                route.provider,
                route.model_identifier,
                "internal",
                "global",
                "review",
                actor_user_id,
            )
            return
        if self.allow_fake_provider:
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
        route = select_model_route(self.repo, review.workspace_id, selected_agents)
        fallback_routes = []
        if route is None:
            fallback_routes.append(missing_model_route(self.allow_fake_provider))
        diversity_enabled = review.mode == ReviewMode.IN_DEPTH.value
        diversity_routes = _diversity_routes(diversity_enabled, selected_agents, route, self.allow_fake_provider)
        return {
            "primary_model": route.metadata() if route is not None else None,
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


def _diversity_routes(
    diversity_enabled: bool,
    selected_agents: list[str],
    route: Any,
    allow_fake: bool,
) -> list[dict[str, str]]:
    if not diversity_enabled:
        return []
    if route is None:
        if not allow_fake:
            return []
        return [{"agent": agent, "provider": "fake", "model_profile": "fake-local"} for agent in selected_agents]
    return [
        {
            "agent": agent,
            "provider": route.provider,
            "model_profile": route.model_profile,
            "model_identifier": route.model_identifier,
        }
        for agent in selected_agents
    ]


def missing_model_route(allow_fake_provider: bool) -> dict[str, str]:
    if allow_fake_provider:
        return {
            "from": "configured model profile",
            "to": "fake-local",
            "reason": "No verified model profile is configured for this workspace.",
        }
    return {
        "from": "configured model profile",
        "to": "blocked",
        "reason": "No verified production model profile is configured for this workspace.",
    }
