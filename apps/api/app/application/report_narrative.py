from __future__ import annotations

from typing import Any

SEVERITY_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1}


def recommendation(findings: list[dict[str, str]], primary_evidence: dict[str, object] | None) -> str:
    top = _top_finding(findings)
    if top and top["severity"] in {"high", "critical"}:
        return (
            "Slow down before committing: this may still be worth doing, but the current plan needs the "
            f"'{top['title']}' issue closed or tested first."
        )
    if primary_evidence:
        return "Run it as a controlled test, not a full commitment, with owners, stop conditions and evidence checks."
    return "Do not make the decision yet: turn the proposal into testable assumptions and gather usable evidence first."


def executive_summary(
    review: Any,
    findings: list[dict[str, str]],
    agent_outputs: list[dict[str, Any]],
    primary_evidence: dict[str, object] | None,
) -> str:
    top = _top_finding(findings)
    agent_count = str(len(agent_outputs)) if agent_outputs else "the selected"
    if top is None:
        return (
            f"The practical read: {review.title} did not produce material specialist findings from "
            f"{agent_count} agent(s). {_evidence_reality(primary_evidence)} Treat that as a narrow pass, not proof "
            "the idea is ready. The next useful move is to add stronger evidence or run a tighter review question."
        )
    issue = _plain_issue(top)
    action = _plain_action(top)
    return (
        f"The practical read: {review.title} is not blocked because the headline idea is impossible. "
        f"It is blocked, or at least slowed down, by {issue}. {_evidence_reality(primary_evidence)} "
        f"In real use, this is likely to fail first where {issue} meets delivery pressure: unclear owners, "
        "missing proof, vague thresholds or no obvious fallback. The next useful move is: "
        f"{action} The report keeps the agent findings visible, then combines them into one decision picture."
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
        values.insert(0, "The plan is still mostly a claim because no source-backed evidence was retrieved.")
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
    ordered_findings = sorted(findings, key=_severity_sort_key, reverse=True)
    top_titles = [finding["title"] for finding in ordered_findings[:5]] or ["No specialist risks were returned."]
    agent_labels = [str(output.get("label", output.get("agent", "Unknown agent"))) for output in agent_outputs]
    top = ordered_findings[0] if ordered_findings else None
    reality = _evidence_reality(primary_evidence)
    issue = _plain_issue(top) if top else "the remaining unknowns"
    action = _plain_action(top) if top else "Add stronger evidence, then rerun the review."
    return {
        "likely_user_intent": (
            f"The user is probably trying to work out whether '{review.title}' survives contact with real users, "
            "real delivery constraints and real consequences, not just whether the proposal sounds sensible."
        ),
        "synthesis": (
            f"Plain reality: {reality} The combined agent view is that the first serious problem is likely to be "
            f"{issue}. If that is left vague, the plan can look fine on paper while still creating delays, blame "
            "shifting, unexpected cost or avoidable user impact when it is used for real."
        ),
        "agents_run": agent_labels,
        "what_will_work": [
            "A staged path can work if each step has a named owner, a success measure and a clear stop condition.",
            "The review setup gives enough direction to expose hidden assumptions, blockers and reality gaps.",
        ],
        "what_will_not_work": [
            f"A broad go/no-go decision will stay weak while {issue} is unresolved.",
            "A polished proposal will not compensate for missing proof, missing ownership or unclear fallback paths.",
        ],
        "top_decision_points": top_titles,
        "recommended_plan": [finding["recommended_action"] for finding in ordered_findings[:5]] or [action],
    }


def strongest_case_for(findings: list[dict[str, str]], primary_evidence: dict[str, object] | None) -> str:
    if primary_evidence and findings:
        return (
            "There is enough structure to run a limited validation: the evidence gives agents something concrete "
            "to challenge, and the main risks can be converted into tests."
        )
    if primary_evidence:
        return "The best case is a small, reversible trial that uses the available evidence to prove or disprove value."
    return "The best case is still possible, but it has to start as a hypothesis test rather than a rollout decision."


def strongest_case_against(findings: list[dict[str, str]], primary_evidence: dict[str, object] | None) -> str:
    top = _top_finding(findings)
    if top:
        return (
            f"The main argument against proceeding is practical: {top['title']} could turn a manageable plan into "
            "rework, confusion or avoidable harm once people depend on it."
        )
    if not primary_evidence:
        return "The main argument against proceeding is that the proposal is not yet backed by usable evidence."
    return (
        "The main argument against proceeding is that low visible risk can still hide untested operating assumptions."
    )


def pre_mortem(findings: list[dict[str, str]], primary_evidence: dict[str, object] | None) -> list[str]:
    top = _top_finding(findings)
    if top:
        return [
            f"The decision fails because '{top['title']}' was treated as a detail instead of a launch blocker.",
            "The team discovers too late that nobody owned the fallback, evidence threshold or user impact tradeoff.",
        ]
    if not primary_evidence:
        return ["The decision fails because the team acted on a plausible story rather than checked evidence."]
    return ["The decision fails because weak assumptions were not converted into explicit validation tests."]


def scenarios(findings: list[dict[str, str]], primary_evidence: dict[str, object] | None) -> dict[str, str]:
    top = _top_finding(findings)
    issue = _plain_issue(top) if top else "the main unknowns"
    evidence_phrase = "source evidence" if primary_evidence else "better evidence"
    return {
        "best": f"{evidence_phrase.title()} confirms the risk is manageable and the team closes {issue} early.",
        "base": f"The idea remains useful, but progress slows while {issue} is clarified and retested.",
        "worst": f"{issue.title()} is ignored, then creates cost, delay or user-facing problems during real use.",
    }


def validation_experiments(findings: list[dict[str, str]], primary_evidence: dict[str, object] | None) -> list[str]:
    top = _top_finding(findings)
    action = _plain_action(top) if top else "Write the smallest test that could disprove the proposal."
    experiments = [
        action,
        "Run a tabletop exercise that walks through ownership, failure handling and rollback.",
    ]
    if not primary_evidence:
        experiments.append(
            "Add at least one concrete source, artefact or user example before treating the result as strong."
        )
    return experiments[:4]


def _top_finding(findings: list[dict[str, str]]) -> dict[str, str] | None:
    if not findings:
        return None
    return sorted(findings, key=_severity_sort_key, reverse=True)[0]


def _severity_sort_key(finding: dict[str, str]) -> int:
    return SEVERITY_RANK.get(finding.get("severity", "medium"), 2)


def _plain_issue(finding: dict[str, str] | None) -> str:
    if finding is None:
        return "the main unresolved assumption"
    return finding.get("title", "the main unresolved assumption").rstrip(".").lower()


def _plain_action(finding: dict[str, str] | None) -> str:
    if finding is None:
        return "Add evidence for the biggest assumption, then rerun the review."
    action = finding.get("recommended_action", "").strip().rstrip(".")
    return action or f"Turn '{finding.get('title', 'this risk')}' into an owner, test and decision rule."


def _evidence_reality(primary_evidence: dict[str, object] | None) -> str:
    if primary_evidence is None:
        return "Right now this is mostly a hypothesis, because no source-backed evidence was retrieved."
    locator = str(primary_evidence.get("locator", "the retrieved evidence"))
    return (
        f"The review has evidence to work from ({locator}), but that evidence should be read as a stress-test input, "
        "not proof that delivery will be easy."
    )
