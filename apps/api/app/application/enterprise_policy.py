from __future__ import annotations

from typing import Any

from app.domain.enums import WorkspaceRole
from app.domain.exceptions import AuthorisationError, ProviderPolicyError, ValidationFailure
from app.domain.policies import require_admin

WRITE_PERMISSIONS = {"owner", "administrator", "editor"}
CUSTOM_AGENT_BLOCKED_TERMS = {
    "ignore system instructions",
    "bypass provider policy",
    "disable output schema",
    "exfiltrate",
}


def normalised_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def require_workspace_admin(role: str | None) -> WorkspaceRole:
    if role is None:
        raise AuthorisationError("Workspace access denied.")
    workspace_role = WorkspaceRole(role)
    require_admin(workspace_role)
    return workspace_role


def require_workspace_member(role: str | None) -> WorkspaceRole:
    if role is None:
        raise AuthorisationError("Workspace access denied.")
    return WorkspaceRole(role)


def require_project_write(workspace_role: str | None, project_permission: str | None) -> None:
    role = require_workspace_member(workspace_role)
    if role in {WorkspaceRole.OWNER, WorkspaceRole.ADMINISTRATOR}:
        return
    if project_permission in WRITE_PERMISSIONS:
        return
    if role is WorkspaceRole.MEMBER and project_permission is None:
        return
    raise AuthorisationError("Project access denied.")


def validate_custom_agent(instructions: str, tool_permissions: list[str], output_schema: dict[str, Any]) -> None:
    lowered = instructions.lower()
    if any(term in lowered for term in CUSTOM_AGENT_BLOCKED_TERMS):
        raise ValidationFailure("Custom agent instructions attempt to bypass platform controls.")
    if "unrestricted_tools" in tool_permissions:
        raise ValidationFailure("Custom agents cannot request unrestricted tool access.")
    if not output_schema:
        raise ValidationFailure("Custom agents require an explicit output schema.")


def enforce_allowlist(name: str, value: str, allowlist: list[str]) -> None:
    if allowlist and value not in allowlist:
        raise ProviderPolicyError(f"{name} is not allowed by workspace governance.")
