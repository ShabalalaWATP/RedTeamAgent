from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import engine
from app.infrastructure.db import models
from app.infrastructure.ingestion import transcription
from app.infrastructure.ingestion.transcription import ProviderAudioTranscriber
from tests.conftest import csrf_headers, register_verified
from tests.test_stage1_api import create_project_review


def test_audio_upload_uses_configured_provider_transcript(
    client: TestClient,
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        ProviderAudioTranscriber,
        "transcribe",
        lambda self, **kwargs: "The budget risk is being hidden by optimistic delivery assumptions.",
    )
    auth = register_verified(client, "audio-transcript@example.com")
    ids = create_project_review(client, auth)
    _select_openai_model(client, auth)

    uploaded = client.post(
        f"/reviews/{ids['review_id']}/sources/upload",
        headers=csrf_headers(auth),
        files={"file": ("voice-note.webm", b"voice bytes", "audio/webm;codecs=opus")},
    )

    assert uploaded.status_code == 200, uploaded.text
    body = uploaded.json()
    assert body["state"] == "ingested"
    assert body["metadata"]["transcript_quality"] == "provider_generated"
    assert body["warnings"] == [
        "Speech-to-text transcription completed with the configured provider; verify transcript quality."
    ]
    with Session(engine) as session:
        chunk = session.scalars(select(models.EvidenceChunk).where(models.EvidenceChunk.source_id == body["id"])).one()
    assert "budget risk" in chunk.text


def test_audio_upload_falls_back_when_transcription_fails(client: TestClient, monkeypatch) -> None:
    def fail_transcription(self, **kwargs: object) -> str | None:
        del self, kwargs
        raise RuntimeError("provider down")

    monkeypatch.setattr(ProviderAudioTranscriber, "transcribe", fail_transcription)
    auth = register_verified(client, "audio-fallback@example.com")
    ids = create_project_review(client, auth)
    _select_openai_model(client, auth)

    uploaded = client.post(
        f"/reviews/{ids['review_id']}/sources/upload",
        headers=csrf_headers(auth),
        files={"file": ("voice-note.webm", b"voice bytes", "audio/webm")},
    )

    assert uploaded.status_code == 200, uploaded.text
    body = uploaded.json()
    assert body["metadata"]["transcript_quality"] == "deterministic_placeholder"
    assert body["warnings"] == ["Speech-to-text transcription failed; local deterministic fallback was used."]
    with Session(engine) as session:
        chunk = session.scalars(select(models.EvidenceChunk).where(models.EvidenceChunk.source_id == body["id"])).one()
    assert chunk.text == "Transcript placeholder for voice-note.webm."


def test_provider_audio_transcriber_builds_bounded_openai_request(monkeypatch) -> None:
    seen: dict[str, Any] = {}

    class FakeResponse:
        def __enter__(self) -> FakeResponse:
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def read(self, size: int) -> bytes:
            assert size == transcription.MAX_TRANSCRIPTION_RESPONSE_BYTES + 1
            return json.dumps({"text": "Actual transcript"}).encode("utf-8")

    class FakeOpener:
        def open(self, request: Any, timeout: int) -> FakeResponse:
            seen["url"] = request.full_url
            seen["timeout"] = timeout
            seen["auth"] = request.get_header("Authorization")
            seen["content_type"] = request.get_header("Content-type")
            seen["data"] = request.data
            return FakeResponse()

    monkeypatch.setattr(transcription, "build_opener", lambda *args: FakeOpener())

    result = ProviderAudioTranscriber().transcribe(
        provider="openai",
        config={"timeout_seconds": 7, "transcription_model": "gpt-4o-mini-transcribe"},
        credentials={"api_key": "sk-test"},
        filename='voice"note.webm',
        content_type="audio/webm",
        content=b"voice bytes",
    )

    assert result == "Actual transcript"
    assert seen["url"] == "https://api.openai.com/v1/audio/transcriptions"
    assert seen["timeout"] == 7
    assert seen["auth"] == "Bearer sk-test"
    assert "multipart/form-data" in seen["content_type"]
    assert b'gpt-4o-mini-transcribe' in seen["data"]
    assert b'filename="voicenote.webm"' in seen["data"]
    assert b"sk-test" not in seen["data"]


def test_provider_audio_transcriber_ignores_unsupported_routes(monkeypatch) -> None:
    opened = False

    class FakeOpener:
        def open(self, request: Any, timeout: int) -> None:
            del request, timeout
            nonlocal opened
            opened = True

    monkeypatch.setattr(transcription, "build_opener", lambda *args: FakeOpener())
    transcriber = ProviderAudioTranscriber()

    assert transcriber.transcribe(
        provider="anthropic",
        config={},
        credentials={"api_key": "test-key"},
        filename="voice.webm",
        content_type="audio/webm",
        content=b"voice",
    ) is None
    assert transcriber.transcribe(
        provider="openai",
        config={},
        credentials={},
        filename="voice.webm",
        content_type="audio/webm",
        content=b"voice",
    ) is None
    assert transcriber.transcribe(
        provider="openai_compatible",
        config={},
        credentials={"api_key": "test-key"},
        filename="voice.webm",
        content_type="audio/webm",
        content=b"voice",
    ) is None
    assert opened is False


def test_provider_audio_transcriber_supports_openai_compatible_endpoint(monkeypatch) -> None:
    seen: dict[str, Any] = {}

    class FakeResponse:
        def __enter__(self) -> FakeResponse:
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def read(self, size: int) -> bytes:
            del size
            return json.dumps({"text": ""}).encode("utf-8")

    class FakeOpener:
        def open(self, request: Any, timeout: int) -> FakeResponse:
            seen["url"] = request.full_url
            seen["timeout"] = timeout
            return FakeResponse()

    monkeypatch.setattr(transcription, "validate_provider_endpoint", lambda url, self_hosted_mode: seen.update({
        "validated": url,
        "self_hosted_mode": self_hosted_mode,
    }))
    monkeypatch.setattr(transcription, "build_opener", lambda *args: FakeOpener())

    result = ProviderAudioTranscriber().transcribe(
        provider="openai_compatible",
        config={"endpoint_url": "https://gateway.example/v1", "timeout_seconds": "bad"},
        credentials={"api_key": "test-key"},
        filename="voice.webm",
        content_type="audio/webm",
        content=b"voice",
    )

    assert result is None
    assert seen["url"] == "https://gateway.example/v1/audio/transcriptions"
    assert seen["validated"] == seen["url"]
    assert seen["self_hosted_mode"] is False
    assert seen["timeout"] == 30


@pytest.mark.parametrize(
    ("opener", "message"),
    [
        (lambda: RaisingOpener(HTTPError("https://api.test", 307, "redirect", {}, None)), "redirects"),
        (lambda: RaisingOpener(HTTPError("https://api.test", 500, "server", {}, None)), "rejected"),
        (lambda: RaisingOpener(URLError("down")), "valid response"),
        (lambda: ResponseOpener(b"[]"), "JSON object"),
        (lambda: ResponseOpener(b"x" * (transcription.MAX_TRANSCRIPTION_RESPONSE_BYTES + 1)), "exceeds"),
    ],
)
def test_transcription_request_errors_are_safe(monkeypatch, opener, message: str) -> None:
    monkeypatch.setattr(transcription, "build_opener", lambda *args: opener())
    request = Request("https://api.openai.com/v1/audio/transcriptions", data=b"body", method="POST")  # noqa: S310

    with pytest.raises(RuntimeError, match=message):
        transcription._request_json(request, 1)


def _select_openai_model(client: TestClient, auth: dict[str, Any]) -> None:
    connection = client.post(
        "/providers/connections",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "adapter": "openai",
            "name": "OpenAI",
            "config": {},
            "credentials": {"api_key": "test-key"},
        },
    )
    assert connection.status_code == 200, connection.text
    model = client.post(
        "/providers/models",
        headers=csrf_headers(auth),
        json={
            "workspace_id": auth["workspace_id"],
            "provider_connection_id": connection.json()["id"],
            "model_identifier": "gpt-4.1-mini",
            "capabilities": ["text", "structured_output"],
            "provenance": "test",
            "verified": True,
        },
    )
    assert model.status_code == 200, model.text
    selected = client.post(f"/providers/models/{model.json()['id']}/select", headers=csrf_headers(auth))
    assert selected.status_code == 200, selected.text


class RaisingOpener:
    def __init__(self, exc: Exception) -> None:
        self.exc = exc

    def open(self, request: Any, timeout: int) -> None:
        del request, timeout
        raise self.exc


class ResponseOpener:
    def __init__(self, payload: bytes) -> None:
        self.payload = payload

    def open(self, request: Any, timeout: int) -> Response:
        del request, timeout
        return Response(self.payload)


class Response:
    def __init__(self, payload: bytes) -> None:
        self.payload = payload

    def __enter__(self) -> Response:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def read(self, size: int) -> bytes:
        del size
        return self.payload
