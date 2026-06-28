from __future__ import annotations

from io import BytesIO
from typing import Any

import pytest
from botocore.exceptions import ClientError
from docx import Document
from fastapi.testclient import TestClient
from pypdf import PdfWriter

from app.application.report_export import export_report
from app.application.workflow_service import WorkflowService
from app.core.database import SessionLocal
from app.domain.exceptions import ValidationFailure
from app.infrastructure.auth.security import PasswordService, TokenService
from app.infrastructure.db import models
from app.infrastructure.db.repositories import SqlRepository
from app.infrastructure.ingestion.extractors import SourceExtractor
from app.infrastructure.providers.adapters import ProviderRegistry
from app.infrastructure.storage import object_storage
from app.infrastructure.storage.object_storage import LocalObjectStorage, S3ObjectStorage
from tests.conftest import csrf_headers, register_verified
from tests.test_stage1_api import create_project_review


def test_auth_error_branches(client: TestClient) -> None:
    weak = client.post("/auth/register", json={"email": "weak@example.com", "password": "too-short"})
    assert weak.status_code == 422
    assert weak.json()["message"] == "Check the form fields and try again."

    weak_complexity = client.post(
        "/auth/register",
        json={"email": "weak-complexity@example.com", "password": "alllowercasepassword"},
    )
    assert weak_complexity.status_code == 422
    assert "uppercase letter" in weak_complexity.json()["message"]
    assert "number" in weak_complexity.json()["message"]
    assert "symbol" in weak_complexity.json()["message"]

    first = client.post(
        "/auth/register",
        json={"email": "dup@example.com", "password": "Correct-Horse-42!"},
    )
    assert first.status_code == 200
    duplicate = client.post(
        "/auth/register",
        json={"email": "dup@example.com", "password": "Correct-Horse-42!"},
    )
    assert duplicate.status_code == 200
    assert duplicate.json()["workspace_role"] is None
    assert duplicate.json()["verification_token"] is None

    unverified = client.post(
        "/auth/login",
        json={"email": "dup@example.com", "password": "Correct-Horse-42!"},
    )
    assert unverified.status_code == 401
    bad_verify = client.post("/auth/verify-email", json={"token": "bad"})
    assert bad_verify.status_code == 401
    missing_reset = client.post("/auth/password-reset/request", json={"email": "missing@example.com"})
    assert missing_reset.status_code == 200
    assert missing_reset.json()["reset_token"] == ""
    bad_reset = client.post(
        "/auth/password-reset/confirm",
        json={"token": "bad", "password": "Correct-Horse-42!"},
    )
    assert bad_reset.status_code == 401


def test_auth_accepts_unusual_safe_inputs_without_sql_interpolation(client: TestClient) -> None:
    password = "Sql-Probe-42!'; DROP TABLE users;--"  # noqa: S105 - validates literal password handling.
    registered = client.post(
        "/auth/register",
        json={"email": "o.hara+safe@example.com", "password": password},
    )
    assert registered.status_code == 200, registered.text

    verified = client.post("/auth/verify-email", json={"token": registered.json()["verification_token"]})
    assert verified.status_code == 204, verified.text

    wrong = client.post("/auth/login", json={"email": "o.hara+safe@example.com", "password": "Wrong-Password-42!"})
    assert wrong.status_code == 401
    assert wrong.json()["message"] == "Invalid email or password."

    logged_in = client.post("/auth/login", json={"email": "o.hara+safe@example.com", "password": password})
    assert logged_in.status_code == 200, logged_in.text


def test_me_project_lists_updates_deletes_and_cancel(client: TestClient) -> None:
    auth = register_verified(client, "routes@example.com")
    ids = create_project_review(client, auth)

    assert client.get("/auth/me").status_code == 200
    projects = client.get(f"/projects?workspace_id={auth['workspace_id']}")
    assert projects.status_code == 200
    assert projects.json()[0]["id"] == ids["project_id"]

    updated = client.put(
        f"/projects/{ids['project_id']}",
        headers=csrf_headers(auth),
        json={"title": "Updated", "description": "Updated description"},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Updated"

    reviews = client.get(f"/projects/{ids['project_id']}/reviews")
    assert reviews.status_code == 200
    assert reviews.json()[0]["id"] == ids["review_id"]

    review_update = client.put(
        f"/reviews/{ids['review_id']}",
        headers=csrf_headers(auth),
        json={
            "title": "Updated review",
            "proposal_text": "Updated proposal",
            "mode": "standard",
            "focus_chips": ["ops"],
            "external_research": True,
            "private_research": True,
            "domain_allowlist": ["example.com"],
            "domain_blocklist": ["localhost"],
        },
    )
    assert review_update.status_code == 200, review_update.text
    assert review_update.json()["title"] == "Updated review"
    assert review_update.json()["domain_allowlist"] == ["example.com"]

    uploaded = client.post(
        f"/reviews/{ids['review_id']}/sources/upload",
        headers=csrf_headers(auth),
        files={"file": ("notes.txt", b"plain source", "text/plain")},
    )
    assert uploaded.status_code == 200

    run = client.post(f"/reviews/{ids['review_id']}/runs", headers=csrf_headers(auth))
    assert run.status_code == 200
    cancelled = client.post(f"/runs/{run.json()['id']}/cancel", headers=csrf_headers(auth))
    assert cancelled.status_code == 200
    assert cancelled.json()["state"] == "completed"

    deleted = client.delete(f"/projects/{ids['project_id']}", headers=csrf_headers(auth))
    assert deleted.status_code == 204


def test_queued_run_can_be_cancelled_before_background_execution(client: TestClient) -> None:
    auth = register_verified(client, "queued@example.com")
    ids = create_project_review(client, auth)
    source = client.post(
        f"/reviews/{ids['review_id']}/sources/text",
        headers=csrf_headers(auth),
        json={"text": "Evidence for queued cancellation path."},
    )
    assert source.status_code == 200

    with SessionLocal() as session:
        service = WorkflowService(SqlRepository(session), ProviderRegistry(False))
        run = service.start_run(str(auth["user_id"]), ids["review_id"], execute_immediately=False)

    cancelled = client.post(f"/runs/{run.id}/cancel", headers=csrf_headers(auth))
    assert cancelled.status_code == 200
    assert cancelled.json()["state"] == "cancelled"

    with SessionLocal() as session:
        service = WorkflowService(SqlRepository(session), ProviderRegistry(False))
        result = service.execute_run(run.id)
        assert result.state == "cancelled"

    events = client.get(f"/runs/{run.id}/events")
    assert [event["state"] for event in events.json()] == ["intake", "cancelled"]
    assert client.get(f"/runs/{run.id}/report").status_code == 404


def test_provider_routes_lists_and_failures(client: TestClient) -> None:
    auth = register_verified(client, "provider@example.com")
    adapters = client.get("/providers/adapters")
    assert adapters.status_code == 200
    assert any(item["key"] == "openai_compatible" for item in adapters.json())
    azure = next(item for item in adapters.json() if item["key"] == "azure_openai")
    assert all(field["name"] != "deployment" for field in azure["fields"])
    assert [item["model_identifier"] for item in azure["catalogue_models"]] == ["gpt-4.1-mini", "gpt-4.1"]

    missing_secret = client.post(
        "/providers/connections",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "adapter": "openai",
            "name": "OpenAI",
            "config": {},
            "credentials": {},
        },
    )
    assert missing_secret.status_code == 422

    fake = client.post(
        "/providers/connections",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "adapter": "fake",
            "name": "Fake",
            "config": {},
            "credentials": {},
        },
    )
    assert fake.status_code == 200
    listed = client.get(f"/providers/connections?workspace_id={auth['workspace_id']}")
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == fake.json()["id"]
    tested = client.post(f"/providers/connections/{fake.json()['id']}/test", headers=csrf_headers(auth))
    assert tested.status_code == 200
    synced = client.post(f"/providers/connections/{fake.json()['id']}/models/sync", headers=csrf_headers(auth))
    assert synced.status_code == 200
    assert synced.json()[0]["provenance"] == "adapter_catalogue:fake"
    assert synced.json()[0]["probe_result"]["source"] == "deterministic_fake_catalogue"
    probed = client.post(f"/providers/models/{synced.json()[0]['id']}/probe", headers=csrf_headers(auth))
    assert probed.status_code == 200
    assert probed.json()["verified"] is True
    assert probed.json()["probe_result"]["source"] == "deterministic_fake_probe"

    model = client.post(
        "/providers/models",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "provider_connection_id": fake.json()["id"],
            "model_identifier": "fake",
            "capabilities": ["text"],
        },
    )
    assert model.status_code == 200
    listed_models = client.get(f"/providers/models?workspace_id={auth['workspace_id']}").json()
    assert any(item["id"] == model.json()["id"] for item in listed_models)

    profile = client.post(
        "/providers/profiles",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "name": "Fake profile",
            "agent_key": "evidence_context",
            "model_record_id": model.json()["id"],
        },
    )
    assert profile.status_code == 200
    profiles = client.get(f"/providers/profiles?workspace_id={auth['workspace_id']}")
    assert profiles.json()[0]["id"] == profile.json()["id"]


def test_provider_credentials_are_encrypted_and_reused(client: TestClient) -> None:
    auth = register_verified(client, "provider-credentials@example.com")
    created = client.post(
        "/providers/connections",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "adapter": "openai",
            "name": "OpenAI",
            "config": {},
            "credentials": {"api_key": "sk-live-test-value"},
        },
    )
    assert created.status_code == 200, created.text
    assert created.json()["has_credentials"] is True
    assert "credentials" not in created.json()

    with SessionLocal() as session:
        connection = session.get(models.ProviderConnection, created.json()["id"])
        assert connection is not None
        sealed = connection.encrypted_credentials["api_key"]
        assert sealed != "sk-live-test-value"
        assert "sk-live-test-value" not in sealed

    tested = client.post(f"/providers/connections/{created.json()['id']}/test", headers=csrf_headers(auth))
    assert tested.status_code == 200, tested.text
    assert tested.json()["ok"] is True


def test_tampered_provider_credentials_fail_closed(client: TestClient) -> None:
    auth = register_verified(client, "tampered-provider@example.com")
    created = client.post(
        "/providers/connections",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "adapter": "openai",
            "name": "OpenAI",
            "config": {},
            "credentials": {"api_key": "sk-live-test-value"},
        },
    )
    assert created.status_code == 200, created.text
    with SessionLocal() as session:
        connection = session.get(models.ProviderConnection, created.json()["id"])
        assert connection is not None
        connection.encrypted_credentials = {"api_key": "tampered"}
        session.commit()
    tested = client.post(f"/providers/connections/{created.json()['id']}/test", headers=csrf_headers(auth))
    assert tested.status_code == 422


def test_extractor_storage_and_token_services(tmp_path: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    extractor = SourceExtractor()
    text_result = extractor.extract("a.txt", "text/plain", b"hello")
    assert text_result.chunks[0].text == "hello"
    with pytest.raises(ValidationFailure):
        extractor.extract("bad.bin", "application/octet-stream", b"bad")

    pdf_buffer = BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    writer.write(pdf_buffer)
    pdf_result = extractor.extract("a.pdf", "application/pdf", pdf_buffer.getvalue())
    assert pdf_result.metadata["pages"] == 1
    assert pdf_result.warnings

    docx_buffer = BytesIO()
    doc = Document()
    doc.add_paragraph("DOCX evidence")
    doc.save(docx_buffer)
    docx_result = extractor.extract(
        "a.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        docx_buffer.getvalue(),
    )
    assert docx_result.chunks[0].text == "DOCX evidence"

    local = LocalObjectStorage(tmp_path)
    local.put("one/two.txt", b"content", "text/plain")
    assert local.get("one/two.txt") == b"content"
    with pytest.raises(ValidationFailure):
        local.put("../escape.txt", b"bad", "text/plain")

    class FakeBody:
        def read(self) -> bytes:
            return b"s3"

    class FakeS3Client:
        def create_bucket(self, Bucket: str) -> None:
            self.bucket = Bucket

        def put_object(self, **kwargs: object) -> None:
            self.object = kwargs

        def get_object(self, **kwargs: object) -> dict[str, object]:
            return {"Body": FakeBody()}

    fake_client = FakeS3Client()
    monkeypatch.setattr(object_storage.boto3, "client", lambda *args, **kwargs: fake_client)
    settings = type(
        "Settings",
        (),
        {
            "s3_bucket": "bucket",
            "s3_endpoint_url": "https://s3.example.test",
            "s3_access_key_id": "id",
            "s3_secret_access_key": "secret",
        },
    )()
    s3 = S3ObjectStorage(settings)
    s3.put("key", b"value", "text/plain")
    assert s3.get("key") == b"s3"

    class ExistingBucketClient(FakeS3Client):
        def create_bucket(self, Bucket: str) -> None:
            del Bucket
            raise ClientError({"Error": {"Code": "BucketAlreadyOwnedByYou"}}, "CreateBucket")

    monkeypatch.setattr(object_storage.boto3, "client", lambda *args, **kwargs: ExistingBucketClient())
    S3ObjectStorage(settings)

    passwords = PasswordService()
    password_hash = passwords.hash("Correct-Horse-42!")
    assert passwords.verify(password_hash, "Correct-Horse-42!") is True
    assert passwords.verify(password_hash, "wrong") is False

    tokens = TokenService("test-secret-key-for-tokens")
    token = tokens.sign("purpose", "value")
    assert tokens.verify("purpose", token, 60) == "value"
    with pytest.raises(ValueError):
        tokens.verify("other", token, 60)


def test_export_report_defaults_to_markdown() -> None:
    data = {
        "title": "Title",
        "provisional_recommendation": "Proceed",
        "executive_summary": "Summary",
        "findings": [{"severity": "low", "title": "Risk", "confidence": "medium", "evidence_label": "source"}],
        "methodology": "Method",
    }
    assert export_report(data, "unknown").startswith("# Title")
