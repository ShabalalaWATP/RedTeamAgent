from __future__ import annotations

from typing import Any

from app.application.ports.repositories import RepositoryPorts
from app.application.usage_policy import UsagePolicy
from app.domain.enums import WorkspaceRole
from app.domain.exceptions import AuthorisationError, NotFoundError, RateLimitExceeded
from app.domain.policies import require_write


class ProjectService:
    def __init__(self, repo: RepositoryPorts, usage_policy: UsagePolicy | None = None) -> None:
        self.repo = repo
        self.usage_policy = usage_policy or UsagePolicy()

    def list_projects(self, user_id: str, workspace_id: str) -> list[Any]:
        self._require_member(user_id, workspace_id)
        return self.repo.list_projects(workspace_id)

    def create_project(self, user_id: str, workspace_id: str, title: str, description: str) -> Any:
        role = self._require_member(user_id, workspace_id)
        require_write(role)
        self._enforce_project_quota(user_id)
        project = self.repo.create_project(workspace_id, user_id, title, description)
        self.repo.audit(workspace_id, user_id, "project.created", {"project_id": project.id})
        self.repo.commit()
        return project

    def update_project(self, user_id: str, project_id: str, title: str, description: str) -> Any:
        project = self._require_project(user_id, project_id)
        require_write(self._role(user_id, project.workspace_id))
        updated = self.repo.update_project(project_id, title, description)
        self.repo.audit(project.workspace_id, user_id, "project.updated", {"project_id": project_id})
        self.repo.commit()
        return updated

    def delete_project(self, user_id: str, project_id: str) -> None:
        project = self._require_project(user_id, project_id)
        require_write(self._role(user_id, project.workspace_id))
        self.repo.delete_project(project_id)
        self.repo.audit(project.workspace_id, user_id, "project.deleted", {"project_id": project_id})
        self.repo.commit()

    def _require_project(self, user_id: str, project_id: str) -> Any:
        project = self.repo.get_project(project_id)
        if project is None:
            raise NotFoundError("Project not found.")
        self._require_member(user_id, project.workspace_id)
        return project

    def _require_member(self, user_id: str, workspace_id: str) -> WorkspaceRole:
        return self._role(user_id, workspace_id)

    def _role(self, user_id: str, workspace_id: str) -> WorkspaceRole:
        role = self.repo.membership_role(workspace_id, user_id)
        if role is None:
            raise AuthorisationError("Workspace access denied.")
        return WorkspaceRole(role)

    def _enforce_project_quota(self, user_id: str) -> None:
        user = self.repo.get_user(user_id)
        if user is None:
            raise AuthorisationError("Workspace access denied.")
        quota = self.usage_policy.quota_for(getattr(user, "account_type", "user"))
        if quota.project_limit is None:
            return
        used = self.repo.count_user_projects(user_id)
        if used >= quota.project_limit:
            raise RateLimitExceeded(
                f"{quota.tier_name} project limit reached ({quota.project_limit}). "
                "Delete an unused project before creating another."
            )
