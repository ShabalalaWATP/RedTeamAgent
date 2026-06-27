from __future__ import annotations

import socket

import pytest

from app.domain.enums import ReviewMode, WorkspaceRole
from app.domain.exceptions import AuthorisationError, ProviderPolicyError, ValidationFailure
from app.domain.policies import (
    assert_capability_route,
    require_admin,
    require_write,
    route_agents,
    validate_provider_endpoint,
    validate_upload,
)
from app.infrastructure.providers.adapters import FakeProviderAdapter, ProviderRegistry


def test_role_policy() -> None:
    require_write(WorkspaceRole.MEMBER)
    require_admin(WorkspaceRole.OWNER)
    with pytest.raises(AuthorisationError):
        require_write(WorkspaceRole.VIEWER)
    with pytest.raises(AuthorisationError):
        require_admin(WorkspaceRole.MEMBER)


def test_upload_policy() -> None:
    assert validate_upload("text/plain", "notes.txt", 5, 10) == "notes.txt"
    with pytest.raises(ValidationFailure):
        validate_upload("text/plain", "notes.exe", 5, 10)
    with pytest.raises(ValidationFailure):
        validate_upload("application/octet-stream", "notes.bin", 5, 10)
    with pytest.raises(ValidationFailure):
        validate_upload("text/plain", "notes.txt", 11, 10)
    with pytest.raises(ValidationFailure):
        validate_upload("text/plain", "../notes.txt", 5, 10)


def test_provider_endpoint_policy(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args: [(None, None, None, None, ("127.0.0.1", 0))])
    with pytest.raises(ProviderPolicyError):
        validate_provider_endpoint("https://example.test", self_hosted_mode=False)
    validate_provider_endpoint("http://example.test", self_hosted_mode=True)
    with pytest.raises(ProviderPolicyError):
        validate_provider_endpoint("ftp://example.test", self_hosted_mode=True)
    with pytest.raises(ProviderPolicyError):
        validate_provider_endpoint("https://169.254.169.254", self_hosted_mode=False)


def test_route_and_capability_policy() -> None:
    decision = route_agents(ReviewMode.IN_DEPTH, ["legal", "policy"])
    assert "legal_regulatory" in {agent.value for agent in decision.selected_agents}
    assert decision.challenge_passes == 3
    assert_capability_route({"text"}, {"text", "streaming"}, explicit_pin=True, fallback_available=False)
    with pytest.raises(ProviderPolicyError):
        assert_capability_route({"text", "private_data"}, {"text"}, explicit_pin=False, fallback_available=True)


def test_agent_routing_avoids_irrelevant_specialists_for_recipe() -> None:
    decision = route_agents(
        ReviewMode.STANDARD,
        ["recipe", "family dinner"],
        "Improve a cooking recipe",
        "Make this recipe clearer and safer for a basic home cook.",
    )
    selected = {agent.value for agent in decision.selected_agents}
    assurance = {agent.value for agent in decision.assurance_agents}

    assert "food_consumer_safety" in selected
    assert "language_clarity" in selected
    assert "cybersecurity_privacy" not in selected
    assert "vulnerability_research_dynamic" not in selected
    assert "legal_regulatory" not in selected
    assert {"source_provenance", "quality_fact_checker"} <= assurance
    assert "zap_active_scan" not in decision.tool_manifest


def test_dynamic_vulnerability_agent_has_controlled_zap_tools() -> None:
    decision = route_agents(
        ReviewMode.IN_DEPTH,
        ["zap", "dast", "staging"],
        "Authorised staging web-app assessment",
        "Run passive dynamic checks against the authorised staging site.",
    )
    selected = {agent.value for agent in decision.selected_agents}

    assert "vulnerability_research_dynamic" in selected
    assert decision.tool_manifest["zap_baseline_scan"]["enabled"] is True
    assert decision.tool_manifest["zap_passive_scan"]["sensitivity"] == "network_passive_scan"
    assert decision.tool_manifest["zap_active_scan"]["enabled"] is False
    assert decision.tool_manifest["zap_active_scan"]["requires_explicit_authorisation"] is True


def test_provider_registry_and_fake_scenarios() -> None:
    registry = ProviderRegistry()
    assert {schema.key for schema in registry.schemas()} >= {"fake", "openai", "openai_compatible"}
    fake = FakeProviderAdapter()
    assert fake.test_connection({"scenario": "valid"}, {})["ok"] is True
    assert fake.test_connection({"scenario": "timeout"}, {})["ok"] is False
    assert "claims" in fake.generate_structured("normal", "specialist")
    assert "claims" not in fake.generate_structured("invalid_schema", "specialist")
