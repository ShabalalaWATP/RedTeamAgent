from __future__ import annotations

from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.infrastructure.db import models


class SiteAdminRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_user(self, user_id: str) -> models.User | None:
        return self.session.get(models.User, user_id)

    def list_users(self) -> list[dict[str, Any]]:
        statement = (
            select(models.User, func.count(models.Run.id))
            .outerjoin(models.Run, models.Run.created_by_user_id == models.User.id)
            .group_by(models.User.id)
            .order_by(desc(models.User.created_at))
        )
        return [
            self._user_row(user, int(run_count or 0))
            for user, run_count in self.session.execute(statement).all()
        ]

    def update_user(
        self,
        user_id: str,
        *,
        account_type: str,
        account_status: str,
        status_message: str,
        admin_scope: str,
        managed_user_ids: list[str],
    ) -> models.User:
        user = self.session.get(models.User, user_id)
        if user is None:
            raise LookupError(user_id)
        user.account_type = account_type
        user.account_status = account_status
        user.status_message = status_message
        user.admin_scope = admin_scope
        user.admin_managed_user_ids = managed_user_ids
        return user

    def delete_user_sessions(self, user_id: str) -> None:
        statement = select(models.SessionRecord).where(models.SessionRecord.user_id == user_id)
        for session in self.session.scalars(statement):
            self.session.delete(session)

    def record_visit(self, user_id: str | None, ip: str, method: str, path: str, user_agent: str) -> None:
        self.session.add(
            models.SiteVisit(
                user_id=user_id,
                ip_address=ip[:64],
                method=method[:16],
                path=path[:500],
                user_agent=user_agent[:500],
            )
        )
        if user_id:
            user = self.session.get(models.User, user_id)
            if user:
                user.last_seen_at = models.utc_now()
                user.last_seen_ip = ip[:64]

    def list_visits(self, limit: int = 100) -> list[models.SiteVisit]:
        statement = select(models.SiteVisit).order_by(desc(models.SiteVisit.created_at)).limit(limit)
        return list(self.session.scalars(statement))

    def audit(self, workspace_id: str | None, actor_user_id: str | None, action: str, metadata: dict[str, Any]) -> None:
        self.session.add(
            models.AuditEvent(
                workspace_id=workspace_id,
                actor_user_id=actor_user_id,
                action=action,
                metadata_json=metadata,
            )
        )

    def commit(self) -> None:
        self.session.commit()

    @staticmethod
    def _user_row(user: models.User, run_count: int) -> dict[str, Any]:
        return {
            "id": user.id,
            "email": user.email,
            "is_verified": user.is_verified,
            "account_type": user.account_type,
            "account_status": user.account_status,
            "status_message": user.status_message,
            "admin_scope": user.admin_scope,
            "admin_managed_user_ids": user.admin_managed_user_ids,
            "created_at": user.created_at,
            "last_login_at": user.last_login_at,
            "last_login_ip": user.last_login_ip,
            "last_seen_at": user.last_seen_at,
            "last_seen_ip": user.last_seen_ip,
            "run_count": run_count,
        }
