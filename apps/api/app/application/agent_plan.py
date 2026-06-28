from __future__ import annotations

from typing import Any

from app.domain.agent_routing import AgentRouteDecision


def selected_agent_views(decision: AgentRouteDecision) -> list[dict[str, object]]:
    return [_agent_view(card) for card in decision.agent_cards]


def assurance_agent_views(decision: AgentRouteDecision) -> list[dict[str, object]]:
    return [_agent_view(card) for card in decision.assurance_cards]


def routing_plan_payload(
    decision: AgentRouteDecision,
    context_packs: list[dict[str, Any]],
    routing_metadata: dict[str, Any],
) -> dict[str, Any]:
    selected_agents = [agent.value for agent in decision.selected_agents]
    primary_model = routing_metadata.get("primary_model")
    fallback_routes = routing_metadata.get("fallback_routes", [])
    return {
        "selected_agents": selected_agents,
        "excluded_agents": {agent.value: reason for agent, reason in decision.excluded_agents.items()},
        "assurance_agents": [agent.value for agent in decision.assurance_agents],
        "agent_cards": decision.agent_cards,
        "assurance_cards": decision.assurance_cards,
        "tool_manifest": decision.tool_manifest,
        "context_strategy": decision.context_strategy,
        "context_packs": context_packs,
        "model_profile": _model_profile(primary_model, fallback_routes),
        "permitted_fallbacks": _permitted_fallbacks(fallback_routes),
        **routing_metadata,
    }


def _agent_view(card: dict[str, object]) -> dict[str, object]:
    return {
        "key": card["key"],
        "label": card["label"],
        "reason": card["selection_reason"],
    }


def _model_profile(primary_model: object, fallback_routes: object) -> str:
    if isinstance(primary_model, dict) and isinstance(primary_model.get("model_profile"), str):
        return primary_model["model_profile"]
    fallbacks = _permitted_fallbacks(fallback_routes)
    return fallbacks[0] if fallbacks else "unconfigured"


def _permitted_fallbacks(fallback_routes: object) -> list[str]:
    if not isinstance(fallback_routes, list):
        return []
    return [
        route["to"]
        for route in fallback_routes
        if isinstance(route, dict) and isinstance(route.get("to"), str) and route["to"] != "blocked"
    ]
