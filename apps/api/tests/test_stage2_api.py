from __future__ import annotations

from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

import pytest
from fastapi.testclient import TestClient

from app.application.search_service import DeterministicSearchProvider, research_queries
from app.application.workflow_retry import classify_failure
from app.infrastructure.ingestion import web_sources
from tests.conftest import csrf_headers, register_verified
from tests.test_stage1_api import create_project_review


def test_stage2_rich_sources_research_report_pdf_and_evaluation(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _mock_public_network(monkeypatch)
    auth = register_verified(client, "stage2@example.com")
    project = client.post(
        "/projects",
        headers=csrf_headers(auth),
        json={"workspace_id": auth["workspace_id"], "title": "Stage 2", "description": ""},
    )
    review = client.post(
        f"/projects/{project.json()['id']}/reviews",
        headers=csrf_headers(auth),
        json={
            "title": "Market launch with external validation",
            "proposal_text": "Launch with evidence checks and no leaked api_key=abcdef1234567890.",
            "mode": "in_depth",
            "focus_chips": ["market", "finance", "accessibility", "medical"],
            "external_research": True,
            "private_research": True,
            "domain_allowlist": ["example.com"],
            "domain_blocklist": ["blocked.example"],
        },
    )
    assert review.status_code == 200, review.text
    review_id = review.json()["id"]

    uploads = [
        ("data.csv", b"name,value\nrisk,high\n", "text/csv"),
        ("deck.pptx", _pptx_bytes(), "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
        ("sheet.xlsx", _xlsx_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        ("image.png", _png_bytes(), "image/png"),
        ("photo.jpg", b"\xff\xd8\xff\xe0stage2", "image/jpeg"),
        ("diagram.webp", b"RIFFstage2WEBP", "image/webp"),
        ("note.webm", b"audio" * 1000, "audio/webm"),
        ("clip.mp4", b"video" * 1000, "video/mp4"),
        ("code.zip", _zip_bytes({"app.py": b"password='abcdef1234567890'\nprint('safe')"}), "application/zip"),
    ]
    upload_responses = {}
    for filename, content, content_type in uploads:
        response = client.post(
            f"/reviews/{review_id}/sources/upload",
            headers=csrf_headers(auth),
            files={"file": (filename, content, content_type)},
        )
        assert response.status_code == 200, response.text
        assert response.json()["state"] == "ingested"
        upload_responses[filename] = response.json()
    assert "Secret-like value" in " ".join(upload_responses["code.zip"]["warnings"])

    website = client.post(
        f"/reviews/{review_id}/sources/website",
        headers=csrf_headers(auth),
        json={"url": "https://example.com/research"},
    )
    assert website.status_code == 200, website.text
    assert website.json()["metadata"]["kind"] == "website"

    repo = client.post(
        f"/reviews/{review_id}/sources/repository",
        headers=csrf_headers(auth),
        json={"url": "https://github.com/example/repo.git"},
    )
    assert repo.status_code == 200, repo.text
    assert repo.json()["metadata"]["kind"] == "public_git_repository"
    assert repo.json()["metadata"]["code_execution"] == "disabled"
    assert repo.json()["metadata"]["language_summary"]["Python"] == 1

    preflight = client.get(f"/reviews/{review_id}/preflight")
    assert preflight.status_code == 200
    body = preflight.json()
    assert body["external_research"] is True
    selected_keys = {agent["key"] for agent in body["selected_agents"]}
    assert {"evidence_context", "comparable_products_research", "commercial_financial"} <= selected_keys
    assert {"medical_clinical", "inclusivity_accessibility", "operations_delivery"} <= selected_keys
    assert "cybersecurity_privacy" not in selected_keys
    assert body["assurance_agents"]
    assert body["context_strategy"]["unselected_agents"] == "Do not load prompts, tools or specialist knowledge packs."
    assert body["research_policy"]["private_mode"] is True
    assert body["model_diversity"]["enabled"] is True
    assert len(body["model_diversity"]["routes"]) == len(selected_keys)
    assert body["fallback_routes"][0]["to"] == "fake-local"

    first_run = client.post(f"/reviews/{review_id}/runs", headers=csrf_headers(auth)).json()
    assert first_run["routing_plan"]["model_diversity"]["enabled"] is True
    assert first_run["routing_plan"]["fallback_routes"][0]["to"] == "fake-local"
    assert "provider_timeout" in first_run["routing_plan"]["retry_policy"]["transient"]
    assert "schema_validation" in first_run["routing_plan"]["retry_policy"]["permanent"]
    report = client.get(f"/runs/{first_run['id']}/report").json()["data"]
    assert report["external_sources"][0]["publisher"] == "example.com"
    assert report["risk_matrix"][0]["colour_independent_label"]
    assert report["action_items"][0]["status"] == "open"
    assert report["scenarios"]["worst"]

    second_run = client.post(f"/reviews/{review_id}/runs", headers=csrf_headers(auth)).json()
    comparison = client.get(f"/runs/{first_run['id']}/report/compare?other_run_id={second_run['id']}")
    assert comparison.status_code == 200
    assert comparison.json()["left_run_id"] == first_run["id"]

    pdf = client.get(f"/runs/{first_run['id']}/report/export?fmt=pdf")
    assert pdf.status_code == 200
    assert pdf.headers["content-type"].startswith("application/pdf")
    assert pdf.content.startswith(b"%PDF")

    evaluation = client.post(
        f"/workspaces/{auth['workspace_id']}/evaluations/stage2",
        headers=csrf_headers(auth),
    )
    assert evaluation.status_code == 200
    assert evaluation.json()["fixture_count"] == 10
    assert evaluation.json()["metrics"]["citation_validity"] > 0.9


def test_stage2_security_guards_for_websites_and_archives(client: TestClient) -> None:
    auth = register_verified(client, "stage2-security@example.com")
    ids = create_project_review(client, auth)
    blocked_website = client.post(
        f"/reviews/{ids['review_id']}/sources/website",
        headers=csrf_headers(auth),
        json={"url": "http://127.0.0.1/internal"},
    )
    assert blocked_website.status_code == 422

    traversal = client.post(
        f"/reviews/{ids['review_id']}/sources/upload",
        headers=csrf_headers(auth),
        files={"file": ("code.zip", _zip_bytes({"../evil.py": b"print('bad')"}), "application/zip")},
    )
    assert traversal.status_code == 200
    assert traversal.json()["state"] == "failed"
    assert "Archive path is not safe" in traversal.json()["warnings"][0]

    nested = client.post(
        f"/reviews/{ids['review_id']}/sources/upload",
        headers=csrf_headers(auth),
        files={"file": ("nested.zip", _zip_bytes({"inner.zip": b"nested"}), "application/zip")},
    )
    assert nested.status_code == 200
    assert nested.json()["state"] == "failed"

    symlink = client.post(
        f"/reviews/{ids['review_id']}/sources/upload",
        headers=csrf_headers(auth),
        files={"file": ("link.zip", _zip_symlink_bytes(), "application/zip")},
    )
    assert symlink.status_code == 200
    assert symlink.json()["state"] == "failed"

    bomb = client.post(
        f"/reviews/{ids['review_id']}/sources/upload",
        headers=csrf_headers(auth),
        files={"file": ("bomb.zip", _zip_bomb_bytes(), "application/zip")},
    )
    assert bomb.status_code == 200
    assert bomb.json()["state"] == "failed"

    bad_filename = client.post(
        f"/reviews/{ids['review_id']}/sources/upload",
        headers=csrf_headers(auth),
        files={"file": ("badname.zip", _zip_bytes({"safe/../evil.py": b"print('bad')"}), "application/zip")},
    )
    assert bad_filename.status_code == 200
    assert bad_filename.json()["state"] == "failed"


def test_stage2_provider_adapters_and_capability_probes(client: TestClient) -> None:
    auth = register_verified(client, "stage2-providers@example.com")
    adapters = client.get("/providers/adapters").json()
    keys = {adapter["key"] for adapter in adapters}
    assert {"azure_openai", "azure_ai_endpoint", "amazon_bedrock", "google_vertex_ai", "ollama", "vllm"} <= keys

    created = client.post(
        "/providers/connections",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "adapter": "ollama",
            "name": "Local Ollama",
            "config": {"endpoint_url": "http://localhost:11434"},
            "credentials": {},
        },
    )
    assert created.status_code == 200, created.text
    synced = client.post(f"/providers/connections/{created.json()['id']}/models/sync", headers=csrf_headers(auth))
    assert synced.status_code == 200
    model = synced.json()[0]
    assert "embeddings" in model["capabilities"]
    probed = client.post(f"/providers/models/{model['id']}/probe", headers=csrf_headers(auth))
    assert probed.status_code == 200
    assert probed.json()["probe_result"]["source"] == "ollama_probe"


def test_stage2_research_query_policy_redacts_sensitive_terms() -> None:
    queries = research_queries("Launch for alex@example.com!", ["medical"], private_mode=False)
    assert "@" not in queries[0]
    private_queries = research_queries("Proprietary launch", ["finance"], private_mode=True)
    assert private_queries == ["decision risk validation", "comparable implementation evidence"]
    provider = DeterministicSearchProvider()
    assert provider.search("query", ["blocked.example"], ["blocked.example"]) == []


def test_stage2_retry_policy_distinguishes_failure_classes() -> None:
    transient = classify_failure("provider_timeout")
    permanent = classify_failure("schema_validation")
    unknown = classify_failure("new_failure")
    assert transient.classification == "transient"
    assert transient.retryable is True
    assert transient.max_attempts == 3
    assert permanent.classification == "permanent"
    assert permanent.retryable is False
    assert unknown.classification == "permanent"
    assert unknown.retryable is False


def _zip_bytes(files: dict[str, bytes]) -> bytes:
    output = BytesIO()
    with ZipFile(output, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return output.getvalue()


def _zip_symlink_bytes() -> bytes:
    output = BytesIO()
    info = ZipInfo("link.py")
    info.external_attr = 0o120777 << 16
    with ZipFile(output, "w") as archive:
        archive.writestr(info, b"target.py")
    return output.getvalue()


def _zip_bomb_bytes() -> bytes:
    output = BytesIO()
    with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("huge.py", b"x" * 2_000_001)
    return output.getvalue()


def _mock_public_network(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(web_sources, "_resolve_host", lambda hostname: ["93.184.216.34"])
    monkeypatch.setattr(
        web_sources,
        "_fetch_once",
        lambda url: web_sources.FetchResponse(
            url,
            200,
            {"content-type": "text/html"},
            b"<html><title>Evidence</title><script>ignore()</script><p>Market evidence</p></html>",
        ),
    )
    monkeypatch.setattr(
        web_sources,
        "_clone_repository_entries",
        lambda url: [("app.py", b"print('review evidence')"), ("package.json", b'{"dependencies": {}}')],
    )


def _pptx_bytes() -> bytes:
    return _zip_bytes({"ppt/slides/slide1.xml": b"<sld><t>Slide evidence</t></sld>"})


def _xlsx_bytes() -> bytes:
    sheet_xml = (
        b"<worksheet><sheetData><row><c><v>Cell evidence</v></c></row></sheetData></worksheet>"
    )
    return _zip_bytes({"xl/worksheets/sheet1.xml": sheet_xml})


def _png_bytes() -> bytes:
    return b"\x89PNG\r\n\x1a\n" + b"\0" * 8 + (1).to_bytes(4, "big") + (1).to_bytes(4, "big") + b"\0" * 16
