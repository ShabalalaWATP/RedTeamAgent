from __future__ import annotations

from types import SimpleNamespace

from app.application.report_narrative import (
    blockers,
    evidence_gaps,
    executive_summary,
    orchestrator_narrative,
    pre_mortem,
    recommendation,
    scenarios,
    strongest_case_against,
    strongest_case_for,
    validation_experiments,
)


def test_executive_summary_explains_practical_reality() -> None:
    review = SimpleNamespace(title="Support chatbot rollout")
    findings = [
        {
            "title": "Escalation ownership is unclear",
            "severity": "high",
            "confidence": "high",
            "category": "delivery",
            "evidence_type": "source",
            "recommended_action": "Name the escalation owner and run a handover drill.",
        }
    ]
    evidence = {"locator": "proposal.md:2"}

    summary = executive_summary(review, findings, [{"label": "Operations"}], evidence)

    assert "The practical read" in summary
    assert "not blocked because the headline idea is impossible" in summary
    assert "real use" in summary
    assert "Name the escalation owner" in summary
    assert recommendation(findings, evidence).startswith("Slow down before committing")


def test_orchestrator_narrative_stays_plain_when_evidence_is_missing() -> None:
    review = SimpleNamespace(title="New onboarding workflow")
    findings = [
        {
            "title": "User impact has not been tested",
            "severity": "critical",
            "confidence": "medium",
            "category": "user_research",
            "evidence_type": "assumption",
            "recommended_action": "Test the workflow with five users before rollout.",
        }
    ]

    narrative = orchestrator_narrative(review, findings, [], None)

    assert narrative["synthesis"].startswith("Plain reality")
    assert "mostly a hypothesis" in narrative["synthesis"]
    assert "delays, blame shifting" in narrative["synthesis"]
    assert narrative["top_decision_points"] == ["User impact has not been tested"]
    assert narrative["recommended_plan"] == ["Test the workflow with five users before rollout."]


def test_supporting_sections_are_derived_from_top_risk() -> None:
    findings = [
        {
            "title": "Rollback plan is missing",
            "severity": "critical",
            "confidence": "high",
            "category": "operations",
            "evidence_type": "inference",
            "recommended_action": "Write and rehearse the rollback plan.",
        }
    ]

    assert "Rollback plan is missing" in strongest_case_against(findings, None)
    assert "Rollback plan is missing" in pre_mortem(findings, None)[0]
    assert "rollback plan is missing" in scenarios(findings, None)["worst"].lower()
    assert validation_experiments(findings, None)[0] == "Write and rehearse the rollback plan"


def test_empty_finding_paths_do_not_overstate_confidence() -> None:
    review = SimpleNamespace(title="Procurement automation")
    source = {"locator": "brief.md:4"}

    no_source_summary = executive_summary(review, [], [], None)
    source_summary = executive_summary(review, [], [{"label": "Operations"}], source)

    assert "mostly a hypothesis" in no_source_summary
    assert "brief.md:4" in source_summary
    assert recommendation([], source).startswith("Run it as a controlled test")
    assert recommendation([], None).startswith("Do not make the decision yet")
    assert blockers([], None)[0].startswith("The plan is still mostly a claim")
    assert evidence_gaps([{"title": "Owner missing", "evidence_type": "unknown"}], source) == [
        "Owner missing is currently supported by unknown evidence."
    ]
    assert strongest_case_for([], source).startswith("The best case is a small")
    assert strongest_case_for([], None).startswith("The best case is still possible")
    assert "not yet backed" in strongest_case_against([], None)
    assert "untested operating assumptions" in strongest_case_against([], source)
    assert "plausible story" in pre_mortem([], None)[0]
    assert "weak assumptions" in pre_mortem([], source)[0]
    assert "main unknowns" in scenarios([], source)["base"]
    assert validation_experiments([], source)[0].startswith("Write the smallest test")
