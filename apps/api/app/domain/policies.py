from __future__ import annotations

import ipaddress
import socket
from collections.abc import Iterable
from urllib.parse import urlparse

from app.domain.agent_routing import AgentRouteDecision, plan_agent_route
from app.domain.enums import ReviewMode, WorkspaceRole
from app.domain.exceptions import AuthorisationError, ProviderPolicyError, ValidationFailure

WRITE_ROLES = {WorkspaceRole.OWNER, WorkspaceRole.ADMINISTRATOR, WorkspaceRole.MEMBER}
ADMIN_ROLES = {WorkspaceRole.OWNER, WorkspaceRole.ADMINISTRATOR}
ALLOWED_UPLOADS = {
    "text/plain": (".txt",),
    "text/markdown": (".md", ".markdown"),
    "text/csv": (".csv",),
    "application/pdf": (".pdf",),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (".docx",),
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": (".pptx",),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": (".xlsx",),
    "image/png": (".png",),
    "image/jpeg": (".jpg", ".jpeg"),
    "image/webp": (".webp",),
    "audio/mpeg": (".mp3",),
    "audio/wav": (".wav",),
    "audio/webm": (".webm",),
    "audio/mp4": (".m4a", ".mp4"),
    "video/mp4": (".mp4",),
    "video/webm": (".webm",),
    "video/quicktime": (".mov",),
    "application/zip": (".zip",),
    "application/x-tar": (".tar",),
    "application/gzip": (".tar.gz", ".tgz"),
}
BLOCKED_METADATA_HOSTS = {"169.254.169.254", "metadata.google.internal"}


RouteDecision = AgentRouteDecision


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
    expected_suffixes = ALLOWED_UPLOADS.get(content_type)
    if expected_suffixes is None:
        raise ValidationFailure("Unsupported file type.")
    if not safe_name.lower().endswith(expected_suffixes):
        raise ValidationFailure("File extension does not match content type.")
    return safe_name


def route_agents(
    mode: ReviewMode,
    focus_chips: list[str],
    title: str = "",
    proposal_text: str = "",
    source_content_types: Iterable[str] = (),
) -> RouteDecision:
    return plan_agent_route(mode, focus_chips, title, proposal_text, source_content_types)


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
    return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified
