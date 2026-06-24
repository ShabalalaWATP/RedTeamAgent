from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlparse

from app.domain.enums import AgentKey, ReviewMode, WorkspaceRole
from app.domain.exceptions import AuthorisationError, ProviderPolicyError, ValidationFailure

WRITE_ROLES = {WorkspaceRole.OWNER, WorkspaceRole.ADMINISTRATOR, WorkspaceRole.MEMBER}
ADMIN_ROLES = {WorkspaceRole.OWNER, WorkspaceRole.ADMINISTRATOR}
ALLOWED_UPLOADS = {
    "text/plain": ".txt",
    "text/markdown": ".md",
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}
BLOCKED_METADATA_HOSTS = {"169.254.169.254", "metadata.google.internal"}


@dataclass(frozen=True)
class RouteDecision:
    selected_agents: list[AgentKey]
    excluded_agents: dict[AgentKey, str]
    mode_budget: int
    challenge_passes: int
    report_depth: str


def require_write(role: WorkspaceRole) -> None:
    if role not in WRITE_ROLES:
        raise AuthorisationError("Workspace role cannot modify this resource.")


def require_admin(role: WorkspaceRole) -> None:
    if role not in ADMIN_ROLES:
        raise AuthorisationError("Workspace role cannot administer this resource.")


def validate_upload(content_type: str, filename: str, size: int, max_size: int) -> str:
    if size <= 0:
        raise ValidationFailure("Upload is empty.")
    if size > max_size:
        raise ValidationFailure("Upload exceeds the configured size limit.")
    safe_name = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    if safe_name != filename or ".." in safe_name:
        raise ValidationFailure("Filename is not safe.")
    expected_suffix = ALLOWED_UPLOADS.get(content_type)
    if expected_suffix is None:
        raise ValidationFailure("Unsupported file type.")
    if not safe_name.lower().endswith(expected_suffix):
        raise ValidationFailure("File extension does not match content type.")
    return safe_name


def route_agents(mode: ReviewMode, focus_chips: list[str]) -> RouteDecision:
    selected = [AgentKey.EVIDENCE_CONTEXT, AgentKey.CYBERSECURITY_PRIVACY, AgentKey.PRODUCT_UX]
    lower_focus = " ".join(focus_chips).lower()
    if mode is not ReviewMode.BASIC:
        selected.extend([AgentKey.SOFTWARE_ARCHITECTURE, AgentKey.OPERATIONS_DELIVERY])
    if mode is ReviewMode.IN_DEPTH or "legal" in lower_focus:
        selected.append(AgentKey.LEGAL_REGULATORY)
    if "policy" in lower_focus or mode is ReviewMode.IN_DEPTH:
        selected.append(AgentKey.POLICY_GOVERNANCE)
    if mode is ReviewMode.IN_DEPTH:
        selected.append(AgentKey.ALTERNATIVE_PERSPECTIVES)

    ordered = list(dict.fromkeys(selected))
    excluded = {
        agent: "Not required for selected mode or focus."
        for agent in AgentKey
        if agent not in ordered
    }
    budgets = {
        ReviewMode.BASIC: (2_000, 1, "concise"),
        ReviewMode.STANDARD: (4_000, 2, "standard"),
        ReviewMode.IN_DEPTH: (8_000, 3, "deep"),
    }
    budget, challenge_passes, report_depth = budgets[mode]
    return RouteDecision(ordered, excluded, budget, challenge_passes, report_depth)


def assert_capability_route(
    required: set[str],
    available: set[str],
    explicit_pin: bool,
    fallback_available: bool,
) -> None:
    if required.issubset(available):
        return
    if explicit_pin or not fallback_available:
        missing = ", ".join(sorted(required - available))
        raise ProviderPolicyError(f"Selected model lacks required capabilities: {missing}.")
    if "private_data" in required and "private_data" not in available:
        raise ProviderPolicyError("Fallback cannot weaken data classification policy.")


def validate_provider_endpoint(url: str, self_hosted_mode: bool) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        if not self_hosted_mode or parsed.scheme != "http":
            raise ProviderPolicyError("Provider endpoint must use HTTPS unless self-hosted mode is enabled.")
    if not parsed.hostname:
        raise ProviderPolicyError("Provider endpoint host is required.")
    if parsed.hostname in BLOCKED_METADATA_HOSTS:
        raise ProviderPolicyError("Provider endpoint cannot target a metadata service.")
    for address in _resolve_host(parsed.hostname):
        ip = ipaddress.ip_address(address)
        if _is_blocked_ip(ip) and not self_hosted_mode:
            raise ProviderPolicyError("Provider endpoint targets a private or local address.")


def _resolve_host(hostname: str) -> list[str]:
    try:
        return [str(info[4][0]) for info in socket.getaddrinfo(hostname, None)]
    except socket.gaierror as exc:
        raise ProviderPolicyError("Provider endpoint host cannot be resolved.") from exc


def _is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )
