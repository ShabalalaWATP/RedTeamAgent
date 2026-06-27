from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass
from hashlib import sha256
from importlib.resources import files
from typing import Any

from app.domain.agents import AGENT_BY_KEY, SPECIALIST_REGISTRY
from app.domain.enums import AgentKey

PACK_RESOURCE_PACKAGE = "app.context_packs.packs"
PACK_CURATED_AT = "2026-06-27"


@dataclass(frozen=True)
class BundledContextPack:
    key: str
    name: str
    version: int
    filename: str
    source_urls: tuple[str, ...] = ()
    licence: str = "Curated summary. Use source URLs for upstream licensing and authoritative text."

    @property
    def id(self) -> str:
        return f"builtin:{self.key}:v{self.version}"

    def markdown(self) -> str:
        return files(PACK_RESOURCE_PACKAGE).joinpath(self.filename).read_text(encoding="utf-8")

    def markdown_sha256(self) -> str:
        return sha256(self.markdown().encode("utf-8")).hexdigest()

    def snapshot(self, referenced_by_agents: list[str]) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "agent_key": referenced_by_agents[0],
            "referenced_by_agents": referenced_by_agents,
            "knowledge_ref": self.key,
            "version": self.version,
            "markdown_sha256": self.markdown_sha256(),
            "source": "bundled",
            "source_urls": list(self.source_urls),
            "licence": self.licence,
            "curated_at": PACK_CURATED_AT,
            "load_strategy": "lazy_selected_agent_only",
            "materialised_for_orchestrator": False,
        }

    def materialised(self, agent_key: str) -> dict[str, Any]:
        return {
            **self.snapshot([agent_key]),
            "markdown": self.markdown(),
            "materialised_for_agent": agent_key,
        }


BUNDLED_CONTEXT_PACKS: dict[str, BundledContextPack] = {
    pack.key: pack
    for pack in (
        BundledContextPack(
            "uk-gov-secure-by-design",
            "UK Government Secure by Design",
            1,
            "uk-gov-secure-by-design.md",
            ("https://www.security.gov.uk/policy-and-guidance/secure-by-design/",),
        ),
        BundledContextPack(
            "ncsc-secure-development",
            "NCSC Secure Development and Deployment",
            1,
            "ncsc-secure-development.md",
            ("https://www.ncsc.gov.uk/collection/developers-collection",),
        ),
        BundledContextPack(
            "ncsc-caf",
            "NCSC Cyber Assessment Framework",
            1,
            "ncsc-caf.md",
            ("https://www.ncsc.gov.uk/collection/cyber-assessment-framework",),
        ),
        BundledContextPack(
            "ico-uk-gdpr-principles",
            "ICO UK GDPR Principles",
            1,
            "ico-uk-gdpr-principles.md",
            ("https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/",),
        ),
        BundledContextPack(
            "ico-lawful-basis",
            "ICO Lawful Basis",
            1,
            "ico-lawful-basis.md",
            ("https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/",),
        ),
        BundledContextPack(
            "ico-controller-processor",
            "ICO Controllers and Processors",
            1,
            "ico-controller-processor.md",
            ("https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/controllers-and-processors/",),
        ),
        BundledContextPack(
            "owasp-asvs",
            "OWASP ASVS 5",
            1,
            "owasp-asvs.md",
            ("https://owasp.org/www-project-application-security-verification-standard/",),
        ),
        BundledContextPack(
            "owasp-top-10",
            "OWASP Top 10 2025",
            1,
            "owasp-top-10.md",
            ("https://owasp.org/Top10/2025/",),
        ),
        BundledContextPack(
            "owasp-zap-automation",
            "OWASP ZAP Automation Framework",
            1,
            "owasp-zap-automation.md",
            ("https://www.zaproxy.org/docs/automate/automation-framework/",),
        ),
        BundledContextPack(
            "owasp-testing-guide",
            "OWASP Web Security Testing Guide",
            1,
            "owasp-testing-guide.md",
            ("https://owasp.org/www-project-web-security-testing-guide/",),
        ),
        BundledContextPack(
            "scan-authorisation-policy",
            "Controlled Scan Authorisation Policy",
            1,
            "scan-authorisation-policy.md",
        ),
        BundledContextPack(
            "cwe-top-25",
            "CWE Top 25 Static Review Lens",
            1,
            "cwe-top-25.md",
        ),
        BundledContextPack(
            "supply-chain-security",
            "Software Supply Chain Security",
            1,
            "supply-chain-security.md",
        ),
        BundledContextPack(
            "threat-modelling",
            "Threat Modelling Review Rubric",
            1,
            "threat-modelling.md",
        ),
        BundledContextPack(
            "source-trust-policy",
            "Source Trust and Evidence Policy",
            1,
            "source-trust-policy.md",
        ),
        BundledContextPack(
            "prompt-injection-defences",
            "Prompt Injection Defence Policy",
            1,
            "prompt-injection-defences.md",
        ),
        BundledContextPack(
            "report-quality-gate",
            "Report Quality Gate",
            1,
            "report-quality-gate.md",
        ),
        BundledContextPack(
            "claim-verification-rubric",
            "Claim Verification Rubric",
            1,
            "claim-verification-rubric.md",
        ),
        BundledContextPack(
            "clean-architecture",
            "Clean Architecture Review Lens",
            1,
            "clean-architecture.md",
        ),
        BundledContextPack(
            "maintainability-checklist",
            "Maintainability Checklist",
            1,
            "maintainability-checklist.md",
        ),
        BundledContextPack(
            "wcag-22",
            "WCAG 2.2 Accessibility Review Lens",
            1,
            "wcag-22.md",
            ("https://www.w3.org/TR/WCAG22/",),
        ),
    )
}


def bundled_context_pack_snapshots(selected_agents: set[str]) -> list[dict[str, Any]]:
    references = _references_for_selected_agents(selected_agents)
    return [
        BUNDLED_CONTEXT_PACKS[ref].snapshot(sorted(agent_keys))
        for ref, agent_keys in references.items()
        if ref in BUNDLED_CONTEXT_PACKS
    ]


def materialise_bundled_context_for_agent(agent_key: str, selected_agents: set[str]) -> list[dict[str, Any]]:
    if agent_key not in selected_agents:
        return []
    try:
        agent = AGENT_BY_KEY[AgentKey(agent_key)]
    except ValueError:
        return []
    return [
        BUNDLED_CONTEXT_PACKS[ref].materialised(agent_key)
        for ref in agent.knowledge_refs
        if ref in BUNDLED_CONTEXT_PACKS
    ]


def missing_bundled_knowledge_refs() -> set[str]:
    referenced = {ref for agent in SPECIALIST_REGISTRY for ref in agent.knowledge_refs}
    return referenced.difference(BUNDLED_CONTEXT_PACKS)


def _references_for_selected_agents(selected_agents: set[str]) -> OrderedDict[str, set[str]]:
    references: OrderedDict[str, set[str]] = OrderedDict()
    for agent_key in sorted(selected_agents):
        try:
            agent = AGENT_BY_KEY[AgentKey(agent_key)]
        except ValueError:
            continue
        for ref in agent.knowledge_refs:
            references.setdefault(ref, set()).add(agent_key)
    return references
