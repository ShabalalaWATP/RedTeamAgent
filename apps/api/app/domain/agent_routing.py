from __future__ import annotations

from collections import OrderedDict
from collections.abc import Iterable
from dataclasses import dataclass

from app.domain.agents import AGENT_BY_KEY, ASSURANCE_AGENT_KEYS, SPECIALIST_AGENT_KEYS, SpecialistAgent
from app.domain.enums import AgentKey, ReviewMode


@dataclass(frozen=True)
class AgentRouteDecision:
    selected_agents: list[AgentKey]
    excluded_agents: dict[AgentKey, str]
    assurance_agents: list[AgentKey]
    mode_budget: int
    challenge_passes: int
    report_depth: str
    agent_cards: list[dict[str, object]]
    assurance_cards: list[dict[str, object]]
    tool_manifest: dict[str, dict[str, object]]
    context_strategy: dict[str, object]


def plan_agent_route(
    mode: ReviewMode,
    focus_chips: list[str],
    title: str = "",
    proposal_text: str = "",
    source_content_types: Iterable[str] = (),
) -> AgentRouteDecision:
    text = _normalise(" ".join([title, proposal_text, *focus_chips, *source_content_types]))
    selected, reasons = _selected_specialists(mode, text)
    selected_keys = list(selected.keys())
    assurance_keys = list(ASSURANCE_AGENT_KEYS)
    excluded = _excluded(selected_keys)
    budget, challenge_passes, report_depth = _mode_budget(mode, selected_keys)
    return AgentRouteDecision(
        selected_agents=selected_keys,
        excluded_agents=excluded,
        assurance_agents=assurance_keys,
        mode_budget=budget,
        challenge_passes=challenge_passes,
        report_depth=report_depth,
        agent_cards=[_agent_card(AGENT_BY_KEY[key], reasons[key]) for key in selected_keys],
        assurance_cards=[_agent_card(AGENT_BY_KEY[key], "Mandatory quality assurance lane.") for key in assurance_keys],
        tool_manifest=_tool_manifest(selected_keys),
        context_strategy={
            "orchestrator": "Receives agent cards, context-pack hashes and evidence summaries only.",
            "selected_agents": (
                "Load matching context-pack Markdown and knowledge refs only during "
                "selected agent execution."
            ),
            "unselected_agents": "Do not load prompts, tools or specialist knowledge packs.",
        },
    )


def _selected_specialists(
    mode: ReviewMode,
    text: str,
) -> tuple[OrderedDict[AgentKey, SpecialistAgent], dict[AgentKey, str]]:
    selected: OrderedDict[AgentKey, SpecialistAgent] = OrderedDict()
    reasons: dict[AgentKey, str] = {}
    for key in SPECIALIST_AGENT_KEYS:
        agent = AGENT_BY_KEY[key]
        terms = _matched_terms(agent, text)
        if agent.default_select:
            selected[key] = agent
            reasons[key] = "Core evidence and context handling is always required."
        elif terms:
            selected[key] = agent
            reasons[key] = f"Matched request terms: {', '.join(terms[:4])}."
    if mode is ReviewMode.IN_DEPTH and _wants_broad_challenge(text):
        for key in SPECIALIST_AGENT_KEYS:
            agent = AGENT_BY_KEY[key]
            if key is AgentKey.VULNERABILITY_DYNAMIC and not _matched_terms(agent, text):
                continue
            selected.setdefault(key, agent)
            reasons.setdefault(key, "In-depth broad challenge was explicitly requested.")
    _add_default_challenge(mode, selected, reasons, text)
    return selected, reasons


def _add_default_challenge(
    mode: ReviewMode,
    selected: OrderedDict[AgentKey, SpecialistAgent],
    reasons: dict[AgentKey, str],
    text: str,
) -> None:
    if mode is ReviewMode.BASIC:
        return
    if len(selected) == 1:
        fallback = AgentKey.ALTERNATIVE_PERSPECTIVES
        if any(term in text for term in ("launch", "rollout", "delivery", "project", "operations")):
            fallback = AgentKey.OPERATIONS_DELIVERY
        selected[fallback] = AGENT_BY_KEY[fallback]
        reasons[fallback] = "Default challenge agent for non-basic reviews with no specialist match."


def _matched_terms(agent: SpecialistAgent, text: str) -> list[str]:
    if any(term in text for term in agent.negative_terms):
        return []
    return [term for term in agent.focus_terms if term in text]


def _excluded(selected: list[AgentKey]) -> dict[AgentKey, str]:
    selected_set = set(selected)
    excluded: dict[AgentKey, str] = {}
    for key in SPECIALIST_AGENT_KEYS:
        if key in selected_set:
            continue
        if key is AgentKey.VULNERABILITY_DYNAMIC:
            excluded[key] = "Dynamic testing tools were not requested or authorised for this review."
        else:
            excluded[key] = "No routing trigger matched the request."
    return excluded


def _mode_budget(mode: ReviewMode, selected: list[AgentKey]) -> tuple[int, int, str]:
    base = {
        ReviewMode.BASIC: (1_600, 1, "concise"),
        ReviewMode.STANDARD: (3_200, 2, "standard"),
        ReviewMode.IN_DEPTH: (5_500, 3, "deep"),
    }[mode]
    budget, challenge_passes, report_depth = base
    return budget + max(0, len(selected) - 2) * 350, challenge_passes, report_depth


def _agent_card(agent: SpecialistAgent, reason: str) -> dict[str, object]:
    return {
        **agent.card(),
        "selection_reason": reason,
        "context_load": "lazy_selected_agent_only",
    }


def _tool_manifest(selected: list[AgentKey]) -> dict[str, dict[str, object]]:
    manifest: dict[str, dict[str, object]] = {}
    for key in selected:
        for tool in AGENT_BY_KEY[key].tool_permissions:
            manifest[tool] = _tool_policy(tool)
    if AgentKey.VULNERABILITY_DYNAMIC in selected:
        manifest["zap_active_scan"] = {
            "enabled": False,
            "sensitivity": "active_scan",
            "requires_explicit_authorisation": True,
            "reason": "OWASP ZAP active scans attack authorised targets and need per-run permission.",
        }
    return manifest


def _tool_policy(tool: str) -> dict[str, object]:
    sensitivity = {
        "read_sources": "read_only",
        "static_code_scan": "local_analysis",
        "dependency_audit": "local_analysis",
        "secret_scan": "local_analysis",  # nosec
        "http_probe": "network_read",
        "browser_probe": "network_read",
        "zap_baseline_scan": "network_passive_scan",
        "zap_passive_scan": "network_passive_scan",
    }.get(tool, "restricted")
    return {"enabled": True, "sensitivity": sensitivity, "requires_explicit_authorisation": False}


def _wants_broad_challenge(text: str) -> bool:
    return any(term in text for term in ("all agents", "full review", "comprehensive", "everything", "complete review"))


def _normalise(value: str) -> str:
    return " ".join(value.lower().replace("_", " ").split())
