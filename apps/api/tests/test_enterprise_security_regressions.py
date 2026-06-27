from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import csrf_headers, register_verified
from tests.test_stage3_enterprise import _create_org_report


def test_enterprise_child_objects_must_match_parent_report_and_workspace(client: TestClient) -> None:
    owner = register_verified(client, "enterprise-idor-owner@example.com")
    workspace_id = client.post(
        "/enterprise/workspaces",
        headers=csrf_headers(owner),
        json={"name": "Primary Security Org"},
    ).json()["id"]
    ids = _create_org_report(client, owner, workspace_id)
    other_workspace_id = client.post(
        "/enterprise/workspaces",
        headers=csrf_headers(owner),
        json={"name": "Secondary Security Org"},
    ).json()["id"]
    other_ids = _create_org_report(client, owner, other_workspace_id)
    other_action = client.post(
        f"/enterprise/reports/{other_ids['report_id']}/actions",
        headers=csrf_headers(owner),
        json={"title": "Other workspace action"},
    )
    assert other_action.status_code == 200, other_action.text

    mismatched_action = client.patch(
        f"/enterprise/reports/{ids['report_id']}/actions/{other_action.json()['id']}",
        headers=csrf_headers(owner),
        json={"status": "done"},
    )
    assert mismatched_action.status_code == 404

    mismatched_journal = client.post(
        f"/enterprise/reviews/{ids['review_id']}/decision-journal",
        headers=csrf_headers(owner),
        json={
            "report_id": other_ids["report_id"],
            "initial_confidence": "medium",
            "final_decision": "blocked",
            "rationale": "Wrong report should not be linkable.",
        },
    )
    assert mismatched_journal.status_code == 403

    mismatched_outcome = client.post(
        f"/enterprise/workspaces/{workspace_id}/outcomes",
        headers=csrf_headers(owner),
        json={"report_id": other_ids["report_id"], "risk_id": "wrong", "materialised": False},
    )
    assert mismatched_outcome.status_code == 403
