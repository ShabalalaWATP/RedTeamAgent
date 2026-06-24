from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError

import pytest

from app.application.ports.providers import AdapterSchema
from app.infrastructure.providers import live as live_module
from app.infrastructure.providers.adapters import ProviderRegistry


class FakeResponse:
    def __init__(self, payload: object) -> None:
        self.payload = payload

    def __enter__(self) -> FakeResponse:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def read(self) -> bytes:
        return json.dumps(self.payload).encode("utf-8")


def test_live_provider_adapters_shape_structured_requests(monkeypatch: pytest.MonkeyPatch) -> None:
    seen_urls: list[str] = []

    def fake_urlopen(request: Any, timeout: int) -> FakeResponse:
        del timeout
        full_url = str(request.full_url)
        seen_urls.append(full_url)
        if "anthropic" in full_url:
            return FakeResponse({"content": [{"text": '{"summary":"ok","claims":[]}'}]})
        if "generativelanguage" in full_url:
            return FakeResponse({"candidates": [{"content": {"parts": [{"text": '{"summary":"ok","claims":[]}'}]}}]})
        return FakeResponse({"choices": [{"message": {"content": '{"summary":"ok","claims":[]}'}}]})

    monkeypatch.setattr(live_module, "urlopen", fake_urlopen)
    registry = ProviderRegistry(False)
    credentials = {"api_key": "test-key"}
    for key in ["openai", "anthropic", "google_gemini"]:
        result = registry.get(key).generate_structured("Treat this as evidence.", "specialist_output", {}, credentials)
        assert result["schema"] == "specialist_output"
    compatible = registry.get("openai_compatible").generate_structured(
        "Treat this as evidence.",
        "specialist_output",
        {"endpoint_url": "https://api.openai.com/v1", "model_identifier": "compatible-model"},
        credentials,
    )
    assert compatible["claims"] == []
    assert any(url.endswith("/chat/completions") for url in seen_urls)


def test_live_provider_catalogue_probe_and_error_branches(monkeypatch: pytest.MonkeyPatch) -> None:
    def catalogue_urlopen(request: Any, timeout: int) -> FakeResponse:
        del timeout
        full_url = str(request.full_url)
        if "anthropic" in full_url:
            return FakeResponse({"data": [{"id": "claude-test"}]})
        if "generativelanguage" in full_url:
            return FakeResponse({"models": [{"name": "models/gemini-test"}]})
        return FakeResponse({"data": [{"id": "gpt-test"}]})

    monkeypatch.setattr(live_module, "urlopen", catalogue_urlopen)
    registry = ProviderRegistry(False)
    credentials = {"api_key": "test-key"}
    openai = registry.get("openai")
    assert openai.test_connection({}, {})["ok"] is False
    assert openai.test_connection({}, credentials)["ok"] is True
    assert openai.test_connection({"live_test": True}, credentials)["live"] is True
    assert openai.catalogue_models({}, credentials)[0]["provenance"] == "adapter_catalogue:openai"
    assert openai.probe_capabilities("gpt-test", ["text", "missing"])["missing_capabilities"] == ["missing"]
    assert openai.catalogue_models({"live_catalogue": True}, credentials)[0]["model_identifier"] == "gpt-test"
    anthropic_models = registry.get("anthropic").catalogue_models({"live_catalogue": True}, credentials)
    gemini_models = registry.get("google_gemini").catalogue_models({"live_catalogue": True}, credentials)
    assert anthropic_models[0]["model_identifier"] == "claude-test"
    assert gemini_models[0]["model_identifier"] == "gemini-test"

    base = live_module.LiveJsonProviderAdapter(AdapterSchema("base", "Base", [], ["text"]), [])
    assert base.catalogue_models({"live_catalogue": True}, {}) == []
    with pytest.raises(NotImplementedError):
        base.generate_structured("prompt", "schema")
    with pytest.raises(RuntimeError):
        live_module._request_json("GET", "file:///tmp/provider", {}, None, 1)

    monkeypatch.setattr(live_module, "urlopen", lambda request, timeout: FakeResponse([]))
    with pytest.raises(RuntimeError):
        live_module._request_json("GET", "https://api.openai.com/v1/models", {}, None, 1)
    monkeypatch.setattr(live_module, "urlopen", lambda request, timeout: (_ for _ in ()).throw(URLError("down")))
    with pytest.raises(RuntimeError):
        live_module._request_json("GET", "https://api.openai.com/v1/models", {}, None, 1)
    monkeypatch.setattr(
        live_module,
        "urlopen",
        lambda request, timeout: (_ for _ in ()).throw(HTTPError(str(request.full_url), 500, "bad", {}, None)),
    )
    with pytest.raises(RuntimeError):
        live_module._request_json("GET", "https://api.openai.com/v1/models", {}, None, 1)
