from __future__ import annotations

from typing import Any


def recommendation(findings: list[dict[str, str]], primary_evidence: dict[str, object] | None) -> str:
    severe = [item for item in findings if item["severity"] in {"high", "critical"}]
    if severe:
        return "Do not treat the plan as ready: resolve the highest-risk blockers, then run a narrower validation pass."
    if primary_evidence:
        return "Proceed only as a controlled validation, with named owners and evidence checks before wider rollout."
    return "Pause the decision until the proposal is supported by usable evidence or narrower testable assumptions."


def executive_summary(
    review: Any,
    findings: list[dict[str, str]],
    agent_outputs: list[dict[str, Any]],
    primary_evidence: dict[str, object] | None,
) -> str:
    evidence_state = "source-backed evidence" if primary_evidence else "review setup only"
    return (
        f"{review.title} was assessed by {len(agent_outputs) or 'the selected'} specialist agent(s) using "
        f"{evidence_state}. The review found {len(findings)} material issue(s), with the main pattern being "
        "whether the plan has enough named ownership, operational proof and decision boundaries to survive real "
        "use. The report below separates specialist findings from the orchestrator synthesis so the user can see "
        "both the raw agent concerns and the combined decision picture."
    )


def dependencies(findings: list[dict[str, str]]) -> list[str]:
    seeded = ["Provider routing policy", "Evidence quality", "Operational ownership"]
    for finding in findings:
        category = finding.get("category", "").replace("_", " ").strip().title()
        if category and category not in seeded:
            seeded.append(category)
    return seeded[:8]


def blockers(findings: list[dict[str, str]], primary_evidence: dict[str, object] | None) -> list[str]:
    values = [item["title"] for item in findings if item["severity"] in {"high", "critical"}][:5]
    if not primary_evidence:
        values.insert(0, "No retrievable source-backed evidence was available.")
    return values


def evidence_gaps(findings: list[dict[str, str]], primary_evidence: dict[str, object] | None) -> list[str]:
    gaps = [] if primary_evidence else ["No source-backed evidence was retrieved."]
    for finding in findings:
        if finding.get("evidence_type") != "source":
            evidence_type = finding.get("evidence_type", "unknown")
            gaps.append(f"{finding['title']} is currently supported by {evidence_type} evidence.")
    return gaps[:8]


def orchestrator_narrative(
    review: Any,
    findings: list[dict[str, str]],
    agent_outputs: list[dict[str, Any]],
    primary_evidence: dict[str, object] | None,
) -> dict[str, Any]:
    top_titles = [finding["title"] for finding in findings[:5]] or ["No specialist risks were returned."]
    agent_labels = [str(output.get("label", output.get("agent", "Unknown agent"))) for output in agent_outputs]
    evidence_state = "The review had source-backed evidence to work from." if primary_evidence else (
        "The review relied on setup text because no source evidence was retrievable."
    )
    return {
        "likely_user_intent": (
            f"The user appears to be asking whether '{review.title}' is realistic, where it could fail, "
            "and what needs to be true before committing to it."
        ),
        "synthesis": (
            f"{evidence_state} The combined agent view is that the plan should be judged less by whether the idea "
            "sounds plausible and more by whether ownership, evidence thresholds, operating constraints and rollback "
            "paths are explicit enough for real execution."
        ),
        "agents_run": agent_labels,
        "what_will_work": [
            "A staged or reversible path can work if each stage has named owners, success criteria and stop "
            "conditions.",
            "The review setup gives enough direction for agents to identify hidden assumptions and operational "
            "blockers.",
        ],
        "what_will_not_work": [
            "A broad go/no-go decision will remain weak if evidence thresholds and responsibility boundaries stay "
            "vague.",
            "Recommendations should not be used as approval unless the unresolved high-risk findings are closed.",
        ],
        "top_decision_points": top_titles,
        "recommended_plan": [finding["recommended_action"] for finding in findings[:5]],
    }
