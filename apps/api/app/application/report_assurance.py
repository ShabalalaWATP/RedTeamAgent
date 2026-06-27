from __future__ import annotations

from typing import Any

from app.domain.exceptions import QualityGateError

SUPPORTED_EVIDENCE_TYPES = {"source", "inference", "assumption", "unknown"}


def quality_assurance_record(report_data: dict[str, Any]) -> dict[str, Any]:
    findings = _findings(report_data)
    checks = [
        _check("findings_present", bool(findings), "Report has at least one structured finding."),
        _check("coverage_map_present", bool(report_data.get("coverage_map")), "Coverage map is present."),
        _check(
            "unsupported_claims_labelled",
            all(finding.get("evidence_type") in SUPPORTED_EVIDENCE_TYPES for finding in findings),
            "Every finding uses an allowed evidence classification.",
        ),
        _check(
            "source_locators_present",
            all(
                finding.get("evidence_type") != "source" or bool(finding.get("evidence_label"))
                for finding in findings
            ),
            "Source-backed findings carry locators.",
        ),
        _check(
            "recommendations_present",
            bool(report_data.get("recommended_actions")),
            "Report includes recommended actions.",
        ),
    ]
    status = "passed" if all(check["passed"] for check in checks) else "failed"
    return {
        "agent": "quality_fact_checker",
        "status": status,
        "checks": checks,
        "claim_count": len(findings),
        "source_backed_findings": sum(1 for finding in findings if finding.get("evidence_type") == "source"),
    }


def enforce_quality_gate(report_data: dict[str, Any]) -> None:
    assurance = quality_assurance_record(report_data)
    if assurance["status"] != "passed":
        failed = [check["name"] for check in assurance["checks"] if not check["passed"]]
        raise QualityGateError(f"Report failed quality gate: {', '.join(failed)}.")


def _findings(report_data: dict[str, Any]) -> list[dict[str, Any]]:
    value = report_data.get("findings", [])
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _check(name: str, passed: bool, description: str) -> dict[str, object]:
    return {"name": name, "passed": passed, "description": description}

