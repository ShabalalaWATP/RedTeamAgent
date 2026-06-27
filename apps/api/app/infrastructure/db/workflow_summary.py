from __future__ import annotations

from typing import Any

from app.infrastructure.db import models


def workflow_summary(
    run: models.Run,
    review: models.Review,
    project: models.Project | None,
    report: models.Report | None,
) -> dict[str, Any]:
    report_data = report.data if report else {}
    findings = report_data.get("findings", []) if isinstance(report_data, dict) else []
    top_risks = _string_list(report_data.get("top_risks", []) if isinstance(report_data, dict) else [])
    selected_agents = _string_list(
        run.routing_plan.get("selected_agents", []) if isinstance(run.routing_plan, dict) else []
    )
    return {
        "id": run.id,
        "workspace_id": run.workspace_id,
        "review_id": run.review_id,
        "review_title": review.title,
        "project_id": project.id if project else None,
        "project_title": project.title if project else "Standalone",
        "mode": review.mode,
        "state": run.state,
        "created_at": run.created_at,
        "selected_agents": selected_agents,
        "top_risks": top_risks,
        "finding_count": len(findings) if isinstance(findings, list) else 0,
        "has_report": report is not None,
    }


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]
