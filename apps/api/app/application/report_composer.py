from __future__ import annotations

from typing import Any

from app.application.ports.repositories import RepositoryPorts
from app.application.search_service import DeterministicSearchProvider, research_queries
from app.domain.agents import AGENT_LABELS
from app.domain.enums import AgentKey


def compose_report(
    repo: RepositoryPorts,
    review: Any,
    run_id: str,
    routing_plan: dict[str, Any],
    provider_output: dict[str, Any] | None = None,
) -> dict[str, Any]:
    sources = repo.list_sources(review.id)
    source_labels = [f"{source.filename}:{source.id}" for source in sources] or [f"Review setup:{review.id}"]
    evidence_query = " ".join([review.title, review.proposal_text, *review.focus_chips])
    retrieved_evidence = repo.search_evidence_chunks(review.workspace_id, review.id, evidence_query, 5)
    if not retrieved_evidence and not sources:
        retrieved_evidence = [_review_setup_evidence_record(review)]
    primary_evidence = retrieved_evidence[0] if retrieved_evidence else None
    evidence_label = str(primary_evidence["locator"]) if primary_evidence else "assumption"
    evidence_type = "source" if primary_evidence else "assumption"
    llm_claims = _llm_claims(provider_output)
    context_packs = _safe_list(routing_plan.get("context_packs", []))
    external_sources = _external_sources(review)
    findings = [
        _finding_from_claim(index, claim, primary_evidence, evidence_label, evidence_type)
        for index, claim in enumerate(llm_claims, start=1)
    ]
    action_items = [
        {
            "id": f"action-{index}",
            "title": finding["recommended_action"],
            "status": "open",
            "owner": "Unassigned",
            "due": None,
            "source": finding["evidence_label"],
        }
        for index, finding in enumerate(findings, start=1)
    ]
    return {
        "id": f"report-{run_id}",
        "title": review.title,
        "provisional_recommendation": "Proceed with controls and validation before irreversible rollout.",
        "executive_summary": "The review found manageable risk with evidence gaps that need active closure.",
        "coverage_map": {
            "sources": len(sources) or 1,
            "agents": routing_plan["selected_agents"],
            "retrieved_evidence": len(retrieved_evidence),
            "external_sources": len(external_sources),
        },
        "top_risks": [finding["title"] for finding in findings],
        "dependencies": ["Provider routing policy", "Evidence quality", "Operational ownership"],
        "blockers": [] if primary_evidence else ["No retrievable evidence was available."],
        "assumptions": ["Report is decision support and not a formal approval record."],
        "evidence_gaps": [] if primary_evidence else ["No source-backed evidence was retrieved."],
        "specialist_findings": _specialist_findings(provider_output, routing_plan["selected_agents"]),
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
        "evidence_quality": {
            "retrieval_score": retrieved_evidence[0]["score"] if retrieved_evidence else 0.0,
            "llm_claim_count": len(llm_claims),
            "llm_agent_count": len(_agent_outputs(provider_output)),
        },
        "llm_review": _llm_review_record(provider_output),
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
            "LLM-grounded workflow with local evidence extraction, hybrid evidence retrieval, optional external "
            "research, full specialist routing, source-linked quality gate and context-pack version snapshot."
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


def _review_setup_evidence_record(review: Any) -> dict[str, Any]:
    focus = ", ".join(review.focus_chips) or "none"
    excerpt = " ".join(
        [
            f"Title: {review.title}",
            f"Proposal: {review.proposal_text}",
            f"Mode: {review.mode}",
            f"Focus chips: {focus}",
        ]
    )
    return {
        "source_id": review.id,
        "source_filename": "Review setup",
        "locator": "review_setup:proposal",
        "excerpt": excerpt,
        "score": 1.0,
    }


def _safe_list(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _llm_claims(provider_output: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not isinstance(provider_output, dict):
        return []
    claims = provider_output.get("claims", [])
    return [claim for claim in claims if isinstance(claim, dict)] if isinstance(claims, list) else []


def _agent_outputs(provider_output: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not isinstance(provider_output, dict):
        return []
    outputs = provider_output.get("agent_outputs", [])
    return [output for output in outputs if isinstance(output, dict)] if isinstance(outputs, list) else []


def _finding_from_claim(
    index: int,
    claim: dict[str, Any],
    primary_evidence: dict[str, object] | None,
    fallback_label: str,
    fallback_type: str,
) -> dict[str, str]:
    evidence_label = _claim_text(claim, "evidence_label", fallback_label)
    evidence_type = _evidence_type(_claim_text(claim, "evidence_type", fallback_type))
    return {
        "id": f"finding-{index}",
        "title": _claim_title(claim, index),
        "severity": _severity(_claim_text(claim, "severity", "medium")),
        "confidence": _confidence(_claim_text(claim, "confidence", "medium")),
        "agent": _claim_text(claim, "agent", "unknown"),
        "category": _claim_text(claim, "category", "review"),
        "evidence_type": evidence_type,
        "evidence_label": evidence_label,
        "evidence_excerpt": str(primary_evidence["excerpt"]) if primary_evidence else "",
        "summary": _claim_text(claim, "summary", _claim_title(claim, index)),
        "recommended_action": _claim_text(claim, "recommended_action", "Review and resolve this agent finding."),
    }


def _claim_text(claim: dict[str, Any] | None, key: str, fallback: str) -> str:
    if claim is None:
        return fallback
    value = claim.get(key)
    return str(value) if isinstance(value, str) and value.strip() else fallback


def _claim_title(claim: dict[str, Any], index: int) -> str:
    title = _claim_text(claim, "title", "")
    if title:
        return title
    summary = _claim_text(claim, "summary", "")
    if summary:
        return summary[:160]
    return f"LLM agent finding {index}"


def _severity(value: str) -> str:
    return value if value in {"low", "medium", "high", "critical"} else "medium"


def _confidence(value: str) -> str:
    return value if value in {"low", "medium", "high", "critical"} else "medium"


def _evidence_type(value: str) -> str:
    return value if value in {"source", "inference", "assumption", "unknown"} else "unknown"


def _llm_review_record(provider_output: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(provider_output, dict):
        return {"summary": "", "claim_count": 0, "agent_outputs": []}
    return {
        "schema": str(provider_output.get("schema", "")),
        "summary": str(provider_output.get("summary", "")),
        "claim_count": len(_llm_claims(provider_output)),
        "agent_outputs": _agent_outputs(provider_output),
    }


def _specialist_findings(provider_output: dict[str, Any] | None, selected_agents: object) -> list[dict[str, Any]]:
    outputs = _agent_outputs(provider_output)
    if outputs:
        return [
            {
                "agent": str(output.get("agent", "unknown")),
                "label": str(output.get("label", output.get("agent", "unknown"))),
                "summary": str(output.get("summary", "")),
                "claim_count": len(output.get("claims", [])) if isinstance(output.get("claims"), list) else 0,
            }
            for output in outputs
        ]
    if not isinstance(selected_agents, list):
        return []
    agent_keys = {agent.value for agent in AgentKey}
    return [
        {"agent": key, "label": AGENT_LABELS[AgentKey(key)]}
        for key in selected_agents
        if isinstance(key, str) and key in agent_keys
    ]
