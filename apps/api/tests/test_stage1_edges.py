from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.application.workflow_service import WorkflowService
from app.domain.exceptions import QualityGateError, RateLimitExceeded
from app.infrastructure.security.rate_limit import AbuseLimiter, LimitRule, MemoryRateLimitStore
from tests.conftest import csrf_headers, register_verified
from tests.test_stage1_api import create_project_review


def test_csrf_and_missing_resource_failures(client: TestClient) -> None:
    auth = register_verified(client, "edge@example.com")
    missing_csrf = client.post(
        "/projects",
        json={"workspace_id": auth["workspace_id"], "title": "No CSRF", "description": ""},
    )
    assert missing_csrf.status_code == 401

    wrong_csrf = client.post(
        "/projects",
        headers={"X-CSRF-Token": "wrong"},
        json={"workspace_id": auth["workspace_id"], "title": "Bad CSRF", "description": ""},
    )
    assert wrong_csrf.status_code == 401

    assert client.get("/runs/missing").status_code == 404
    assert client.get("/projects?workspace_id=missing").status_code == 403
    assert client.post(
        "/context-packs",
        headers=csrf_headers(auth),
        json={
            "workspace_id": "missing",
            "name": "bad",
            "agent_key": "evidence_context",
            "markdown": "bad",
        },
    ).status_code == 403


def test_provider_missing_resources_and_unknown_adapter(client: TestClient) -> None:
    auth = register_verified(client, "provider-edge@example.com")
    unknown = client.post(
        "/providers/connections",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "adapter": "unknown",
            "name": "Unknown",
            "config": {},
            "credentials": {},
        },
    )
    assert unknown.status_code == 422
    assert client.post("/providers/connections/missing/test", headers=csrf_headers(auth)).status_code == 404

    bad_model = client.post(
        "/providers/models",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "provider_connection_id": "missing",
            "model_identifier": "missing",
            "capabilities": ["text"],
        },
    )
    assert bad_model.status_code == 404

    bad_profile = client.post(
        "/providers/profiles",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "name": "bad",
            "agent_key": "evidence_context",
            "model_record_id": "missing",
        },
    )
    assert bad_profile.status_code == 404


def test_failed_extraction_is_visible_and_context_pack_list_works(client: TestClient) -> None:
    auth = register_verified(client, "extract-edge@example.com")
    ids = create_project_review(client, auth)
    failed = client.post(
        f"/reviews/{ids['review_id']}/sources/upload",
        headers=csrf_headers(auth),
        files={"file": ("bad.pdf", b"not-a-pdf", "application/pdf")},
    )
    assert failed.status_code == 200
    assert failed.json()["state"] == "failed"
    assert failed.json()["warnings"]

    pack = client.post(
        "/context-packs",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "name": "Listed",
            "agent_key": "evidence_context",
            "markdown": "# Listed",
        },
    )
    assert pack.status_code == 200
    packs = client.get(f"/context-packs?workspace_id={auth['workspace_id']}")
    assert packs.status_code == 200
    assert packs.json()[0]["name"] == "Listed"


def test_no_source_report_and_quality_gate_branches(client: TestClient) -> None:
    auth = register_verified(client, "nosource@example.com")
    ids = create_project_review(client, auth)
    run = client.post(f"/reviews/{ids['review_id']}/runs", headers=csrf_headers(auth))
    assert run.status_code == 200
    report = client.get(f"/runs/{run.json()['id']}/report")
    assert report.json()["data"]["findings"][0]["evidence_type"] == "assumption"
    assert report.json()["data"]["retrieved_evidence"] == []
    assert report.json()["data"]["blockers"]

    with pytest.raises(QualityGateError):
        WorkflowService._quality_gate({"findings": [{"evidence_type": "unsupported"}]})
    with pytest.raises(QualityGateError):
        WorkflowService._quality_gate({"findings": [{"evidence_type": "source", "evidence_label": ""}]})


def test_rate_limiter_branch() -> None:
    limiter = AbuseLimiter(MemoryRateLimitStore())
    rule = LimitRule("test", limit=2, window_seconds=60)
    limiter.check(rule, "key")
    limiter.check(rule, "key")
    with pytest.raises(RateLimitExceeded):
        limiter.check(rule, "key")
