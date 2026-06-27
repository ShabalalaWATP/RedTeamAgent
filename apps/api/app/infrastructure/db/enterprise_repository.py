from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import delete, desc, select
from sqlalchemy.orm import Session

from app.infrastructure.db import enterprise_models as em
from app.infrastructure.db import models


class SqlEnterpriseRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def membership_role(self, workspace_id: str, user_id: str) -> str | None:
        membership = self.session.scalar(
            select(models.WorkspaceMembership).where(
                models.WorkspaceMembership.workspace_id == workspace_id,
                models.WorkspaceMembership.user_id == user_id,
            )
        )
        return membership.role if membership else None

    def create_organisation_workspace(self, owner_user_id: str, name: str) -> models.Workspace:
        workspace = models.Workspace(name=name)
        self.session.add(workspace)
        self.session.flush()
        self.session.add(
            models.WorkspaceMembership(workspace_id=workspace.id, user_id=owner_user_id, role="owner")
        )
        self.session.add(em.WorkspaceGovernance(workspace_id=workspace.id))
        self.session.flush()
        return workspace

    def list_members(self, workspace_id: str) -> list[dict[str, Any]]:
        statement = (
            select(models.WorkspaceMembership, models.User)
            .join(models.User, models.User.id == models.WorkspaceMembership.user_id)
            .where(models.WorkspaceMembership.workspace_id == workspace_id)
        )
        return [
            {
                "user_id": user.id,
                "email": user.email,
                "role": membership.role,
                "workspace_id": workspace_id,
            }
            for membership, user in self.session.execute(statement).all()
        ]

    def add_member(self, workspace_id: str, user_id: str, role: str) -> models.WorkspaceMembership:
        existing = self.session.scalar(
            select(models.WorkspaceMembership).where(
                models.WorkspaceMembership.workspace_id == workspace_id,
                models.WorkspaceMembership.user_id == user_id,
            )
        )
        if existing:
            existing.role = role
            return existing
        membership = models.WorkspaceMembership(workspace_id=workspace_id, user_id=user_id, role=role)
        self.session.add(membership)
        self.session.flush()
        return membership

    def create_invitation(
        self,
        workspace_id: str,
        email: str,
        role: str,
        token_hash: str,
        invited_by_user_id: str,
        expires_at: datetime,
    ) -> em.WorkspaceInvitation:
        invitation = em.WorkspaceInvitation(
            workspace_id=workspace_id,
            email=email.lower(),
            role=role,
            token_hash=token_hash,
            invited_by_user_id=invited_by_user_id,
            expires_at=expires_at,
        )
        self.session.add(invitation)
        self.session.flush()
        return invitation

    def invitation_by_hash(self, token_hash: str) -> em.WorkspaceInvitation | None:
        statement = select(em.WorkspaceInvitation).where(em.WorkspaceInvitation.token_hash == token_hash)
        return self.session.scalar(statement)

    def list_invitations(self, workspace_id: str) -> list[em.WorkspaceInvitation]:
        statement = select(em.WorkspaceInvitation).where(em.WorkspaceInvitation.workspace_id == workspace_id)
        return list(self.session.scalars(statement.order_by(desc(em.WorkspaceInvitation.created_at))))

    def mark_invitation_accepted(self, invitation_id: str) -> None:
        invitation = self.session.get(em.WorkspaceInvitation, invitation_id)
        if invitation:
            invitation.accepted_at = datetime.now(UTC)

    def get_user(self, user_id: str) -> models.User | None:
        return self.session.get(models.User, user_id)

    def get_project(self, project_id: str) -> models.Project | None:
        return self.session.get(models.Project, project_id)

    def get_review(self, review_id: str) -> models.Review | None:
        return self.session.get(models.Review, review_id)

    def get_run(self, run_id: str) -> models.Run | None:
        return self.session.get(models.Run, run_id)

    def list_runs(self, workspace_id: str) -> list[models.Run]:
        statement = select(models.Run).where(models.Run.workspace_id == workspace_id)
        return list(self.session.scalars(statement))

    def get_report(self, report_id: str) -> models.Report | None:
        return self.session.get(models.Report, report_id)

    def get_report_by_run(self, run_id: str) -> models.Report | None:
        return self.session.scalar(select(models.Report).where(models.Report.run_id == run_id))

    def list_model_records(self, workspace_id: str) -> list[models.ModelRecord]:
        statement = select(models.ModelRecord).where(models.ModelRecord.workspace_id == workspace_id)
        return list(self.session.scalars(statement))

    def get_project_permission(self, project_id: str, user_id: str) -> str | None:
        permission = self.session.scalar(
            select(em.ProjectPermission).where(
                em.ProjectPermission.project_id == project_id,
                em.ProjectPermission.user_id == user_id,
            )
        )
        return permission.permission if permission else None

    def upsert_project_permission(
        self,
        workspace_id: str,
        project_id: str,
        user_id: str,
        permission: str,
    ) -> em.ProjectPermission:
        existing = self.session.scalar(
            select(em.ProjectPermission).where(
                em.ProjectPermission.project_id == project_id,
                em.ProjectPermission.user_id == user_id,
            )
        )
        if existing:
            existing.permission = permission
            return existing
        created = em.ProjectPermission(
            workspace_id=workspace_id,
            project_id=project_id,
            user_id=user_id,
            permission=permission,
        )
        self.session.add(created)
        self.session.flush()
        return created

    def list_project_permissions(self, project_id: str) -> list[em.ProjectPermission]:
        statement = select(em.ProjectPermission).where(em.ProjectPermission.project_id == project_id)
        return list(self.session.scalars(statement))

    def create_comment(self, data: dict[str, Any]) -> em.ReportComment:
        return self._create(em.ReportComment, data)

    def list_comments(self, report_id: str) -> list[em.ReportComment]:
        return list(self.session.scalars(select(em.ReportComment).where(em.ReportComment.report_id == report_id)))

    def create_action(self, data: dict[str, Any]) -> em.ReportAction:
        return self._create(em.ReportAction, data)

    def get_action(self, action_id: str) -> em.ReportAction | None:
        return self.session.get(em.ReportAction, action_id)

    def update_action_status(self, action_id: str, status: str) -> em.ReportAction:
        action = self.session.get(em.ReportAction, action_id)
        if action is None:
            raise LookupError(action_id)
        action.status = status
        return action

    def list_actions(self, report_id: str) -> list[em.ReportAction]:
        return list(self.session.scalars(select(em.ReportAction).where(em.ReportAction.report_id == report_id)))

    def create_journal(self, data: dict[str, Any]) -> em.DecisionJournal:
        return self._create(em.DecisionJournal, data)

    def list_journal(self, review_id: str) -> list[em.DecisionJournal]:
        return list(self.session.scalars(select(em.DecisionJournal).where(em.DecisionJournal.review_id == review_id)))

    def create_notification(self, data: dict[str, Any]) -> em.Notification:
        return self._create(em.Notification, data)

    def list_notifications(self, workspace_id: str, user_id: str | None = None) -> list[em.Notification]:
        statement = select(em.Notification).where(em.Notification.workspace_id == workspace_id)
        if user_id is not None:
            statement = statement.where((em.Notification.user_id == user_id) | (em.Notification.user_id.is_(None)))
        return list(self.session.scalars(statement.order_by(desc(em.Notification.created_at))))

    def create_share(self, data: dict[str, Any]) -> em.ReportShare:
        return self._create(em.ReportShare, data)

    def share_by_hash(self, token_hash: str) -> em.ReportShare | None:
        return self.session.scalar(select(em.ReportShare).where(em.ReportShare.token_hash == token_hash))

    def list_shares(self, report_id: str) -> list[em.ReportShare]:
        return list(self.session.scalars(select(em.ReportShare).where(em.ReportShare.report_id == report_id)))

    def get_governance(self, workspace_id: str) -> em.WorkspaceGovernance:
        governance = self.session.get(em.WorkspaceGovernance, workspace_id)
        if governance is None:
            governance = em.WorkspaceGovernance(workspace_id=workspace_id)
            self.session.add(governance)
            self.session.flush()
        return governance

    def update_governance(self, workspace_id: str, data: dict[str, Any]) -> em.WorkspaceGovernance:
        governance = self.get_governance(workspace_id)
        for key, value in data.items():
            if hasattr(governance, key):
                setattr(governance, key, value)
        governance.updated_at = datetime.now(UTC)
        return governance

    def create_scim_mapping(self, data: dict[str, Any]) -> em.ScimMapping:
        return self._create(em.ScimMapping, data)

    def list_scim_mappings(self, workspace_id: str) -> list[em.ScimMapping]:
        return self._list_workspace(em.ScimMapping, workspace_id)

    def create_custom_agent(self, data: dict[str, Any]) -> em.CustomAgentDefinition:
        return self._create(em.CustomAgentDefinition, data)

    def list_custom_agents(self, workspace_id: str) -> list[em.CustomAgentDefinition]:
        return self._list_workspace(em.CustomAgentDefinition, workspace_id)

    def create_rubric(self, data: dict[str, Any]) -> em.CustomRiskRubric:
        return self._create(em.CustomRiskRubric, data)

    def list_rubrics(self, workspace_id: str) -> list[em.CustomRiskRubric]:
        return self._list_workspace(em.CustomRiskRubric, workspace_id)

    def create_template(self, data: dict[str, Any]) -> em.ReportTemplate:
        return self._create(em.ReportTemplate, data)

    def list_templates(self, workspace_id: str) -> list[em.ReportTemplate]:
        return self._list_workspace(em.ReportTemplate, workspace_id)

    def create_api_token(self, data: dict[str, Any]) -> em.ApiToken:
        return self._create(em.ApiToken, data)

    def list_api_tokens(self, workspace_id: str) -> list[em.ApiToken]:
        return self._list_workspace(em.ApiToken, workspace_id)

    def get_api_token(self, token_id: str) -> em.ApiToken | None:
        return self.session.get(em.ApiToken, token_id)

    def revoke_api_token(self, token_id: str) -> em.ApiToken:
        token = self.session.get(em.ApiToken, token_id)
        if token is None:
            raise LookupError(token_id)
        token.revoked_at = datetime.now(UTC)
        return token

    def create_webhook(self, data: dict[str, Any]) -> em.WebhookEndpoint:
        return self._create(em.WebhookEndpoint, data)

    def list_webhooks(self, workspace_id: str) -> list[em.WebhookEndpoint]:
        return self._list_workspace(em.WebhookEndpoint, workspace_id)

    def get_webhook(self, webhook_id: str) -> em.WebhookEndpoint | None:
        return self.session.get(em.WebhookEndpoint, webhook_id)

    def record_webhook_replay(self, webhook_id: str, signature: str, timestamp: int) -> None:
        self.session.add(em.WebhookReplay(webhook_id=webhook_id, signature=signature, timestamp=timestamp))

    def webhook_signatures(self, webhook_id: str) -> set[str]:
        statement = select(em.WebhookReplay.signature).where(em.WebhookReplay.webhook_id == webhook_id)
        return {str(value) for value in self.session.scalars(statement)}

    def create_scheduled_review(self, data: dict[str, Any]) -> em.ScheduledReview:
        return self._create(em.ScheduledReview, data)

    def list_scheduled_reviews(self, workspace_id: str) -> list[em.ScheduledReview]:
        return self._list_workspace(em.ScheduledReview, workspace_id)

    def due_scheduled_reviews(self, workspace_id: str, now: datetime) -> list[em.ScheduledReview]:
        statement = select(em.ScheduledReview).where(
            em.ScheduledReview.workspace_id == workspace_id,
            em.ScheduledReview.enabled.is_(True),
            em.ScheduledReview.next_run_at <= now,
        )
        return list(self.session.scalars(statement))

    def advance_scheduled_review(self, schedule: em.ScheduledReview, now: datetime) -> None:
        schedule.last_run_at = now
        schedule.next_run_at = now + timedelta(days=schedule.interval_days)

    def create_outcome(self, data: dict[str, Any]) -> em.OutcomeRecord:
        return self._create(em.OutcomeRecord, data)

    def list_outcomes(self, workspace_id: str) -> list[em.OutcomeRecord]:
        return self._list_workspace(em.OutcomeRecord, workspace_id)

    def create_data_request(self, data: dict[str, Any]) -> em.DataRequest:
        return self._create(em.DataRequest, data)

    def list_data_requests(self, workspace_id: str) -> list[em.DataRequest]:
        return self._list_workspace(em.DataRequest, workspace_id)

    def complete_data_request(self, request_id: str, result: dict[str, Any]) -> em.DataRequest:
        request = self.session.get(em.DataRequest, request_id)
        if request is None:
            raise LookupError(request_id)
        request.status = "completed"
        request.result = result
        request.completed_at = datetime.now(UTC)
        return request

    def delete_expired_notifications(self, workspace_id: str, before: datetime) -> int:
        statement = delete(em.Notification).where(
            em.Notification.workspace_id == workspace_id,
            em.Notification.created_at < before,
        )
        result = self.session.execute(statement)
        rowcount = getattr(result, "rowcount", 0)
        return int(rowcount or 0)

    def list_audit_events(self, workspace_id: str) -> list[models.AuditEvent]:
        statement = select(models.AuditEvent).where(models.AuditEvent.workspace_id == workspace_id)
        return list(self.session.scalars(statement.order_by(desc(models.AuditEvent.created_at))))

    def audit(self, workspace_id: str | None, actor_user_id: str | None, action: str, metadata: dict[str, Any]) -> None:
        safe_metadata = {
            key: value for key, value in metadata.items() if key not in {"token", "secret", "body", "instructions"}
        }
        self.session.add(
            models.AuditEvent(
                workspace_id=workspace_id,
                actor_user_id=actor_user_id,
                action=action,
                metadata_json=safe_metadata,
            )
        )

    def commit(self) -> None:
        self.session.commit()

    def _create(self, model_class: type[Any], data: dict[str, Any]) -> Any:
        item = model_class(**data)
        self.session.add(item)
        self.session.flush()
        return item

    def _list_workspace(self, model_class: type[Any], workspace_id: str) -> list[Any]:
        statement = select(model_class).where(model_class.workspace_id == workspace_id)
        return list(self.session.scalars(statement))
