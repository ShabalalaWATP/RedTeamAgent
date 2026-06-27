from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domain.enums import WorkspaceRole
from app.infrastructure.auth.security import new_session_expiry
from app.infrastructure.db import models


class IdentityRepositoryMixin:
    session: Session

    def create_user(self, email: str, password_hash: str, account_type: str = "user") -> models.User:
        user = models.User(email=email.lower(), password_hash=password_hash, account_type=account_type)
        self.session.add(user)
        self.session.flush()
        return user

    def get_user_by_email(self, email: str) -> models.User | None:
        return self.session.scalar(select(models.User).where(models.User.email == email.lower()))

    def get_user(self, user_id: str) -> models.User | None:
        return self.session.get(models.User, user_id)

    def has_site_owner(self) -> bool:
        statement = select(func.count()).select_from(models.User).where(models.User.account_type == "owner")
        return bool(self.session.scalar(statement))

    def verify_user(self, user_id: str) -> None:
        user = self.session.get(models.User, user_id)
        if user:
            user.is_verified = True

    def update_password(self, user_id: str, password_hash: str) -> None:
        user = self.session.get(models.User, user_id)
        if user:
            user.password_hash = password_hash

    def get_mfa_setting(self, user_id: str) -> models.UserMfaSetting | None:
        return self.session.get(models.UserMfaSetting, user_id)

    def upsert_mfa_setting(
        self,
        user_id: str,
        secret_ciphertext: str,
        recovery_code_hashes: list[str],
        *,
        enabled: bool,
    ) -> models.UserMfaSetting:
        setting = self.session.get(models.UserMfaSetting, user_id)
        if setting is None:
            setting = models.UserMfaSetting(user_id=user_id, secret_ciphertext=secret_ciphertext)
            self.session.add(setting)
        setting.secret_ciphertext = secret_ciphertext
        setting.recovery_code_hashes = recovery_code_hashes
        setting.enabled = enabled
        setting.enabled_at = models.utc_now() if enabled else None
        self.session.flush()
        return setting

    def enable_mfa_setting(self, user_id: str) -> None:
        setting = self.session.get(models.UserMfaSetting, user_id)
        if setting:
            setting.enabled = True
            setting.enabled_at = models.utc_now()

    def disable_mfa_setting(self, user_id: str) -> None:
        setting = self.session.get(models.UserMfaSetting, user_id)
        if setting:
            self.session.delete(setting)

    def update_mfa_recovery_hashes(self, user_id: str, recovery_code_hashes: list[str]) -> None:
        setting = self.session.get(models.UserMfaSetting, user_id)
        if setting:
            setting.recovery_code_hashes = recovery_code_hashes

    def create_session(self, user_id: str, csrf_token: str) -> models.SessionRecord:
        record = models.SessionRecord(
            user_id=user_id,
            csrf_token=csrf_token,
            expires_at=new_session_expiry(),
        )
        self.session.add(record)
        self.session.flush()
        return record

    def get_session(self, session_id: str) -> models.SessionRecord | None:
        record = self.session.get(models.SessionRecord, session_id)
        if record is None:
            return None
        expires_at = record.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at > datetime.now(UTC):
            return record
        return None

    def delete_session(self, session_id: str) -> None:
        record = self.session.get(models.SessionRecord, session_id)
        if record:
            self.session.delete(record)

    def delete_user_sessions(self, user_id: str) -> None:
        statement = select(models.SessionRecord).where(models.SessionRecord.user_id == user_id)
        for session in self.session.scalars(statement):
            self.session.delete(session)

    def create_personal_workspace(self, user_id: str, email: str) -> models.Workspace:
        workspace = models.Workspace(name=f"{email}'s workspace")
        self.session.add(workspace)
        self.session.flush()
        membership = models.WorkspaceMembership(
            workspace_id=workspace.id, user_id=user_id, role=WorkspaceRole.OWNER.value
        )
        self.session.add(membership)
        self.session.flush()
        return workspace

    def membership_role(self, workspace_id: str, user_id: str) -> str | None:
        membership = self.session.scalar(
            select(models.WorkspaceMembership).where(
                models.WorkspaceMembership.workspace_id == workspace_id,
                models.WorkspaceMembership.user_id == user_id,
            )
        )
        return membership.role if membership else None

    def list_workspaces(self, user_id: str) -> list[models.Workspace]:
        statement = (
            select(models.Workspace)
            .join(models.WorkspaceMembership, models.WorkspaceMembership.workspace_id == models.Workspace.id)
            .where(models.WorkspaceMembership.user_id == user_id)
        )
        return list(self.session.scalars(statement))
