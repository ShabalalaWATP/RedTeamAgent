from __future__ import annotations

from typing import Any

from app.application.ports.repositories import RepositoryPorts
from app.application.search_service import DeterministicSearchProvider, research_queries
from app.domain.agents import AGENT_LABELS
from app.domain.enums import AgentKey


def compose_report(repo: RepositoryPorts, review: Any, run_id: str, routing_plan: dict[str, Any]) -> dict[str, Any]:
    sources = repo.list_sources(review.id)
    source_labels = [f"{source.filename}:{source.id}" for source in sources]
    evidence_query = " ".join([review.title, review.proposal_text, *review.focus_chips])
    retrieved_evidence = repo.search_evidence_chunks(review.workspace_id, review.id, evidence_query, 5)
    primary_evidence = retrieved_evidence[0] if retrieved_evidence else None
    evidence_label = str(primary_evidence["locator"]) if primary_evidence else "assumption"
    evidence_type = "source" if primary_evidence else "assumption"
    context_packs = _safe_list(routing_plan.get("context_packs", []))
    external_sources = _external_sources(review)
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
        "specialist_findings": _specialist_findings(routing_plan["selected_agents"]),
        "context_packs": context_packs,
        "agent_cards": _safe_list(routing_plan.get("agent_cards", [])),
        "assurance_agents": _safe_list(routing_plan.get("assurance_cards", [])),
        "tool_manifest": routing_plan.get("tool_manifest", {}),
        "context_strategy": routing_plan.get("context_strategy", {}),
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
        "strongest_case_against": "Proceeding without named owners can turn manageable gaps into operational failure.",
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


def _external_sources(review: Any) -> list[dict[str, Any]]:
    if not review.external_research:
        return []
    provider = DeterministicSearchProvider()
    results: list[dict[str, Any]] = []
    for query in research_queries(review.title, review.focus_chips, review.private_research):
        results.extend(provider.search(query, review.domain_allowlist, review.domain_blocklist))
    return results


def _safe_list(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _specialist_findings(selected_agents: object) -> list[dict[str, str]]:
    if not isinstance(selected_agents, list):
        return []
    agent_keys = {agent.value for agent in AgentKey}
    return [
        {"agent": key, "label": AGENT_LABELS[AgentKey(key)]}
        for key in selected_agents
        if isinstance(key, str) and key in agent_keys
    ]
