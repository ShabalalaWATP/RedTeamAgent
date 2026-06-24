from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Any

from app.application.enterprise_policy import (
    normalised_list,
    require_project_write,
    require_workspace_admin,
    require_workspace_member,
    validate_custom_agent,
)
from app.domain.exceptions import AuthorisationError, ConflictError, NotFoundError, ValidationFailure


class EnterpriseService:
    def __init__(self, repo: Any) -> None:
        self.repo = repo

    def create_workspace(self, user_id: str, name: str) -> dict[str, Any]:
        workspace = self.repo.create_organisation_workspace(user_id, name)
        self.repo.audit(workspace.id, user_id, "enterprise.workspace_created", {"name": name})
        self.repo.commit()
        return {"id": workspace.id, "name": workspace.name, "workspace_type": "organisation"}

    def list_members(self, user_id: str, workspace_id: str) -> list[dict[str, Any]]:
        require_workspace_member(self.repo.membership_role(workspace_id, user_id))
        return self.repo.list_members(workspace_id)

    def invite_member(self, user_id: str, workspace_id: str, email: str, role: str) -> dict[str, Any]:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        token = secrets.token_urlsafe(32)
        invitation = self.repo.create_invitation(
            workspace_id,
            email,
            role,
            self._hash(token),
            user_id,
            datetime.now(UTC) + timedelta(days=7),
        )
        self.repo.audit(workspace_id, user_id, "enterprise.invitation_created", {"email": email, "role": role})
        self.repo.commit()
        return self._invitation_view(invitation) | {"token": token}

    def list_invitations(self, user_id: str, workspace_id: str) -> list[dict[str, Any]]:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        return [self._invitation_view(item) for item in self.repo.list_invitations(workspace_id)]

    def accept_invitation(self, user_id: str, token: str) -> dict[str, Any]:
        user = self.repo.get_user(user_id)
        invitation = self.repo.invitation_by_hash(self._hash(token))
        if user is None or invitation is None:
            raise NotFoundError("Invitation not found.")
        if invitation.accepted_at is not None:
            raise ConflictError("Invitation has already been accepted.")
        if self._aware(invitation.expires_at) <= datetime.now(UTC):
            raise ValidationFailure("Invitation has expired.")
        if invitation.email.lower() != user.email.lower():
            raise AuthorisationError("Invitation email does not match the signed-in user.")
        membership = self.repo.add_member(invitation.workspace_id, user_id, invitation.role)
        self.repo.mark_invitation_accepted(invitation.id)
        self.repo.audit(invitation.workspace_id, user_id, "enterprise.invitation_accepted", {"role": invitation.role})
        self.repo.commit()
        return {"workspace_id": membership.workspace_id, "user_id": membership.user_id, "role": membership.role}

    def set_project_permission(self, user_id: str, project_id: str, target_user_id: str, permission: str) -> Any:
        project = self._project(project_id)
        require_workspace_admin(self.repo.membership_role(project.workspace_id, user_id))
        item = self.repo.upsert_project_permission(project.workspace_id, project_id, target_user_id, permission)
        self.repo.audit(project.workspace_id, user_id, "enterprise.project_permission_set", {"project_id": project_id})
        self.repo.commit()
        return item

    def list_project_permissions(self, user_id: str, project_id: str) -> list[Any]:
        project = self._project(project_id)
        require_workspace_admin(self.repo.membership_role(project.workspace_id, user_id))
        return self.repo.list_project_permissions(project_id)

    def add_comment(self, user_id: str, report_id: str, body: str, finding_id: str | None) -> Any:
        report = self._report_with_write(user_id, report_id)
        comment = self.repo.create_comment(
            {
                "report_id": report.id,
                "workspace_id": report.workspace_id,
                "author_user_id": user_id,
                "body": body,
                "finding_id": finding_id,
            }
        )
        self.repo.create_notification(
            {"workspace_id": report.workspace_id, "user_id": None, "kind": "comment", "title": "New report comment"}
        )
        self.repo.audit(report.workspace_id, user_id, "enterprise.report_comment_created", {"report_id": report.id})
        self.repo.commit()
        return comment

    def list_comments(self, user_id: str, report_id: str) -> list[Any]:
        report = self._report(report_id)
        require_workspace_member(self.repo.membership_role(report.workspace_id, user_id))
        return self.repo.list_comments(report_id)

    def create_action(self, user_id: str, report_id: str, data: dict[str, Any]) -> Any:
        report = self._report_with_write(user_id, report_id)
        action = self.repo.create_action({"report_id": report.id, "workspace_id": report.workspace_id, **data})
        self.repo.create_notification(
            {
                "workspace_id": report.workspace_id,
                "user_id": data.get("owner_user_id"),
                "kind": "assigned_action",
                "title": str(data["title"]),
            }
        )
        self.repo.audit(report.workspace_id, user_id, "enterprise.report_action_created", {"report_id": report.id})
        self.repo.commit()
        return action

    def update_action(self, user_id: str, report_id: str, action_id: str, status: str) -> Any:
        report = self._report_with_write(user_id, report_id)
        action = self.repo.update_action_status(action_id, status)
        self.repo.audit(report.workspace_id, user_id, "enterprise.report_action_updated", {"action_id": action.id})
        self.repo.commit()
        return action

    def list_actions(self, user_id: str, report_id: str) -> list[Any]:
        report = self._report(report_id)
        require_workspace_member(self.repo.membership_role(report.workspace_id, user_id))
        return self.repo.list_actions(report_id)

    def add_journal(self, user_id: str, review_id: str, data: dict[str, Any]) -> Any:
        review = self._review(review_id)
        require_project_write(
            self.repo.membership_role(review.workspace_id, user_id),
            self.repo.get_project_permission(review.project_id, user_id),
        )
        report = self._report(str(data["report_id"]))
        journal = self.repo.create_journal(
            {
                "review_id": review_id,
                "report_id": report.id,
                "workspace_id": review.workspace_id,
                "created_by_user_id": user_id,
                **data,
            }
        )
        self.repo.audit(review.workspace_id, user_id, "enterprise.decision_journal_created", {"review_id": review_id})
        self.repo.commit()
        return journal

    def list_journal(self, user_id: str, review_id: str) -> list[Any]:
        review = self._review(review_id)
        require_workspace_member(self.repo.membership_role(review.workspace_id, user_id))
        return self.repo.list_journal(review_id)

    def create_share(self, user_id: str, report_id: str, access_mode: str, expires_at: datetime) -> dict[str, Any]:
        report = self._report_with_write(user_id, report_id)
        token = secrets.token_urlsafe(32)
        share = self.repo.create_share(
            {
                "report_id": report.id,
                "workspace_id": report.workspace_id,
                "token_hash": self._hash(token),
                "access_mode": access_mode,
                "created_by_user_id": user_id,
                "expires_at": expires_at,
            }
        )
        self.repo.audit(report.workspace_id, user_id, "report_share.created", {"report_id": report.id})
        self.repo.commit()
        return self._share_view(share) | {"token": token}

    def list_shares(self, user_id: str, report_id: str) -> list[dict[str, Any]]:
        report = self._report(report_id)
        require_workspace_member(self.repo.membership_role(report.workspace_id, user_id))
        return [self._share_view(item) for item in self.repo.list_shares(report_id)]

    def access_share(self, token: str) -> dict[str, Any]:
        share = self.repo.share_by_hash(self._hash(token))
        if share is None or share.revoked or self._aware(share.expires_at) <= datetime.now(UTC):
            raise NotFoundError("Report share not found or expired.")
        report = self._report(share.report_id)
        self.repo.audit(share.workspace_id, None, "report_share.accessed", {"report_id": report.id})
        self.repo.commit()
        return {"report_id": report.id, "access_mode": share.access_mode, "data": report.data}

    def get_governance(self, user_id: str, workspace_id: str) -> Any:
        require_workspace_member(self.repo.membership_role(workspace_id, user_id))
        return self.repo.get_governance(workspace_id)

    def update_governance(self, user_id: str, workspace_id: str, data: dict[str, Any]) -> Any:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        governance = self.repo.update_governance(workspace_id, data)
        self.repo.audit(workspace_id, user_id, "enterprise.governance_updated", {"fields": sorted(data)})
        self.repo.commit()
        return governance

    def create_scim_mapping(self, user_id: str, workspace_id: str, data: dict[str, Any]) -> Any:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        mapping = self.repo.create_scim_mapping({"workspace_id": workspace_id, **data})
        self.repo.audit(workspace_id, user_id, "enterprise.scim_mapping_created", {"mapping_id": mapping.id})
        self.repo.commit()
        return mapping

    def list_scim_mappings(self, user_id: str, workspace_id: str) -> list[Any]:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        return self.repo.list_scim_mappings(workspace_id)

    def list_notifications(self, user_id: str, workspace_id: str) -> list[Any]:
        require_workspace_member(self.repo.membership_role(workspace_id, user_id))
        return self.repo.list_notifications(workspace_id, user_id)

    def create_custom_agent(self, user_id: str, workspace_id: str, data: dict[str, Any]) -> Any:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        validate_custom_agent(
            str(data["instructions"]),
            normalised_list(data["tool_permissions"]),
            data["output_schema"],
        )
        agent = self.repo.create_custom_agent({"workspace_id": workspace_id, "approved_by_user_id": user_id, **data})
        self.repo.audit(workspace_id, user_id, "enterprise.custom_agent_created", {"agent_id": agent.id})
        self.repo.commit()
        return agent

    def list_custom_agents(self, user_id: str, workspace_id: str) -> list[Any]:
        require_workspace_member(self.repo.membership_role(workspace_id, user_id))
        return self.repo.list_custom_agents(workspace_id)

    def create_named_config(self, user_id: str, workspace_id: str, kind: str, data: dict[str, Any]) -> Any:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        factories = {"rubric": self.repo.create_rubric, "template": self.repo.create_template}
        item = factories[kind]({"workspace_id": workspace_id, **data})
        self.repo.audit(workspace_id, user_id, f"enterprise.{kind}_created", {f"{kind}_id": item.id})
        self.repo.commit()
        return item

    def list_named_config(self, user_id: str, workspace_id: str, kind: str) -> list[Any]:
        require_workspace_member(self.repo.membership_role(workspace_id, user_id))
        factories = {"rubric": self.repo.list_rubrics, "template": self.repo.list_templates}
        return factories[kind](workspace_id)

    @staticmethod
    def _hash(value: str) -> str:
        return sha256(value.encode("utf-8")).hexdigest()

    @staticmethod
    def _aware(value: datetime) -> datetime:
        return value if value.tzinfo is not None else value.replace(tzinfo=UTC)

    def _project(self, project_id: str) -> Any:
        project = self.repo.get_project(project_id)
        if project is None:
            raise NotFoundError("Project not found.")
        return project

    def _review(self, review_id: str) -> Any:
        review = self.repo.get_review(review_id)
        if review is None:
            raise NotFoundError("Review not found.")
        return review

    def _report(self, report_id: str) -> Any:
        report = self.repo.get_report(report_id)
        if report is None:
            raise NotFoundError("Report not found.")
        return report

    def _report_with_write(self, user_id: str, report_id: str) -> Any:
        report = self._report(report_id)
        run = self.repo.get_run(report.run_id)
        review = self.repo.get_review(run.review_id) if run else None
        project_permission = self.repo.get_project_permission(review.project_id, user_id) if review else None
        require_project_write(self.repo.membership_role(report.workspace_id, user_id), project_permission)
        return report

    @staticmethod
    def _invitation_view(invitation: Any) -> dict[str, Any]:
        return {
            "id": invitation.id,
            "workspace_id": invitation.workspace_id,
            "email": invitation.email,
            "role": invitation.role,
            "expires_at": invitation.expires_at,
            "accepted_at": invitation.accepted_at,
        }

    @staticmethod
    def _share_view(share: Any) -> dict[str, Any]:
        return {
            "id": share.id,
            "report_id": share.report_id,
            "workspace_id": share.workspace_id,
            "access_mode": share.access_mode,
            "expires_at": share.expires_at,
            "revoked": share.revoked,
        }
