from __future__ import annotations

import socket

import pytest

from app.application.provenance import context_pack_snapshot
from app.context_packs.catalog import (
    BUNDLED_CONTEXT_PACKS,
    materialise_bundled_context_for_agent,
    missing_bundled_knowledge_refs,
)
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
    assert validate_upload("audio/webm;codecs=opus", "note.webm", 5, 10) == "note.webm"
    assert validate_upload("audio/x-wav", "note.wav", 5, 10) == "note.wav"
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
    with pytest.raises(ProviderPolicyError):
        validate_provider_endpoint("https://user:pass@example.test", self_hosted_mode=False)


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


def test_agent_knowledge_refs_have_bundled_context_packs() -> None:
    assert missing_bundled_knowledge_refs() == set()
    assert "uk-gov-secure-by-design" in BUNDLED_CONTEXT_PACKS
    assert "owasp-zap-automation" in BUNDLED_CONTEXT_PACKS
    assert "ico-lawful-basis" in BUNDLED_CONTEXT_PACKS


def test_bundled_context_materialises_only_for_selected_agent() -> None:
    selected = {"secure_by_design"}
    materialised = materialise_bundled_context_for_agent("secure_by_design", selected)

    assert {pack["knowledge_ref"] for pack in materialised} == {
        "uk-gov-secure-by-design",
        "ncsc-secure-development",
        "ncsc-caf",
    }
    assert all(pack["materialised_for_orchestrator"] is False for pack in materialised)
    assert all("markdown" in pack for pack in materialised)
    assert materialise_bundled_context_for_agent("uk_data_protection", selected) == []


def test_context_pack_snapshot_includes_only_selected_agent_references() -> None:
    decision = route_agents(
        ReviewMode.IN_DEPTH,
        ["secure by design", "uk gdpr", "zap"],
        "Secure by design GDPR staging assessment",
        "Assess secure-by-design controls, personal data governance and passive ZAP checks.",
    )
    context_agents = {agent.value for agent in [*decision.selected_agents, *decision.assurance_agents]}
    snapshots = context_pack_snapshot([], context_agents)
    refs = {pack["knowledge_ref"] for pack in snapshots if pack.get("source") == "bundled"}

    assert {
        "uk-gov-secure-by-design",
        "ico-uk-gdpr-principles",
        "owasp-zap-automation",
        "source-trust-policy",
        "report-quality-gate",
    } <= refs
    assert "clean-architecture" not in refs
    assert all(pack["materialised_for_orchestrator"] is False for pack in snapshots)
    assert all("markdown" not in pack for pack in snapshots)


def test_provider_registry_and_fake_scenarios() -> None:
    registry = ProviderRegistry()
    assert {schema.key for schema in registry.schemas()} >= {"fake", "openai", "openai_compatible"}
    fake = FakeProviderAdapter()
    assert fake.test_connection({"scenario": "valid"}, {})["ok"] is True
    assert fake.test_connection({"scenario": "timeout"}, {})["ok"] is False
    assert "claims" in fake.generate_structured("normal", "specialist")
    assert "claims" not in fake.generate_structured("invalid_schema", "specialist")
