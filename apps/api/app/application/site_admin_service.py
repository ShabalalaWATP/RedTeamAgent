from __future__ import annotations

from typing import Any

from app.domain.exceptions import AuthorisationError, NotFoundError, ValidationFailure

ACCOUNT_TYPES = {"owner", "admin", "user"}
ACCOUNT_STATUSES = {"active", "suspended", "banned", "deleted"}
ADMIN_SCOPES = {"none", "all", "selected"}


class SiteAdminService:
    def __init__(self, repo: Any) -> None:
        self.repo = repo

    def list_users(self, actor_id: str) -> list[dict[str, Any]]:
        actor = self._actor(actor_id)
        return [row for row in self.repo.list_users() if self._can_view(actor, row)]

    def list_visits(self, actor_id: str) -> list[dict[str, Any]]:
        actor = self._actor(actor_id)
        visible_user_ids = {row["id"] for row in self.list_users(actor_id)}
        return [
            self._visit_view(visit)
            for visit in self.repo.list_visits()
            if actor.account_type == "owner" or visit.user_id is None or visit.user_id in visible_user_ids
        ]

    def update_user(self, actor_id: str, target_id: str, data: dict[str, Any]) -> dict[str, Any]:
        actor = self._actor(actor_id)
        target = self.repo.get_user(target_id)
        if target is None:
            raise NotFoundError("User not found.")
        self._require_can_manage(actor, target)
        next_type = self._next_type(actor, target, data.get("account_type"))
        next_status = self._validated(data.get("account_status", target.account_status), ACCOUNT_STATUSES, "status")
        next_scope = self._next_scope(next_type, data.get("admin_scope", target.admin_scope))
        managed_ids = self._managed_ids(
            next_type,
            next_scope,
            data.get("admin_managed_user_ids", target.admin_managed_user_ids),
        )
        message = str(data.get("status_message", target.status_message) or "")[:500]
        if target.id == actor.id and (next_type != "owner" or next_status != "active"):
            raise ValidationFailure("Owners cannot demote, suspend, ban or delete their own account.")
        user = self.repo.update_user(
            target.id,
            account_type=next_type,
            account_status=next_status,
            status_message=message,
            admin_scope=next_scope,
            managed_user_ids=managed_ids,
        )
        if next_status != "active":
            self.repo.delete_user_sessions(user.id)
        self.repo.audit(None, actor.id, "site_admin.user_updated", {"target_user_id": user.id})
        row = next(row for row in self.repo.list_users() if row["id"] == user.id)
        self.repo.commit()
        return row

    def record_visit(self, session_user_id: str | None, ip: str, method: str, path: str, user_agent: str) -> None:
        self.repo.record_visit(session_user_id, ip, method, path.split("?", 1)[0], user_agent)
        self.repo.commit()

    def _actor(self, actor_id: str) -> Any:
        actor = self.repo.get_user(actor_id)
        if actor is None:
            raise AuthorisationError("Site admin access required.")
        if actor.account_type not in {"owner", "admin"}:
            raise AuthorisationError("Site admin access required.")
        if actor.account_status != "active":
            raise AuthorisationError("Site admin access required.")
        return actor

    def _can_view(self, actor: Any, row: dict[str, Any]) -> bool:
        if actor.account_type == "owner":
            return True
        if row["account_type"] != "user":
            return False
        if actor.admin_scope == "all":
            return True
        return row["id"] in set(actor.admin_managed_user_ids or [])

    def _require_can_manage(self, actor: Any, target: Any) -> None:
        if actor.account_type == "owner":
            return
        if target.account_type != "user":
            raise AuthorisationError("Admins can only manage user accounts assigned to them.")
        if actor.admin_scope != "all" and target.id not in set(actor.admin_managed_user_ids or []):
            raise AuthorisationError("Admins can only manage user accounts assigned to them.")

    def _next_type(self, actor: Any, target: Any, value: object) -> str:
        if actor.account_type != "owner":
            return target.account_type
        return self._validated(value or target.account_type, ACCOUNT_TYPES, "account type")

    def _next_scope(self, account_type: str, value: object) -> str:
        if account_type != "admin":
            return "none"
        return self._validated(value or "selected", ADMIN_SCOPES, "admin scope")

    def _managed_ids(self, account_type: str, scope: str, value: object) -> list[str]:
        if account_type != "admin" or scope != "selected":
            return []
        if not isinstance(value, list):
            return []
        return [str(item) for item in value if str(item)]

    @staticmethod
    def _validated(value: object, allowed: set[str], label: str) -> str:
        clean = str(value)
        if clean not in allowed:
            raise ValidationFailure(f"Unsupported {label}.")
        return clean

    @staticmethod
    def _visit_view(visit: Any) -> dict[str, Any]:
        return {
            "id": visit.id,
            "user_id": visit.user_id,
            "ip_address": visit.ip_address,
            "method": visit.method,
            "path": visit.path,
            "user_agent": visit.user_agent,
            "created_at": visit.created_at,
        }
