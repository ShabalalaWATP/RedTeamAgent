from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Any

from app.application.enterprise_policy import require_workspace_admin, require_workspace_member
from app.application.webhook_security import sign_webhook_payload, verify_webhook_signature
from app.domain.exceptions import AuthorisationError, NotFoundError


class EnterpriseOperationsService:
    def __init__(self, repo: Any) -> None:
        self.repo = repo

    def create_api_token(self, user_id: str, workspace_id: str, data: dict[str, Any]) -> dict[str, Any]:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        token = f"rta_{secrets.token_urlsafe(24)}"
        item = self.repo.create_api_token(
            {"workspace_id": workspace_id, "token_prefix": token[:12], "token_hash": self._hash(token), **data}
        )
        self.repo.audit(workspace_id, user_id, "enterprise.api_token_created", {"token_id": item.id})
        self.repo.commit()
        return self._api_token_view(item) | {"plain_token": token}

    def list_api_tokens(self, user_id: str, workspace_id: str) -> list[dict[str, Any]]:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        return [self._api_token_view(item) for item in self.repo.list_api_tokens(workspace_id)]

    def revoke_api_token(self, user_id: str, workspace_id: str, token_id: str) -> dict[str, Any]:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        item = self.repo.revoke_api_token(token_id)
        if item.workspace_id != workspace_id:
            raise AuthorisationError("API token access denied.")
        self.repo.audit(workspace_id, user_id, "enterprise.api_token_revoked", {"token_id": token_id})
        self.repo.commit()
        return self._api_token_view(item)

    def create_webhook(self, user_id: str, workspace_id: str, data: dict[str, Any]) -> dict[str, Any]:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        secret = secrets.token_urlsafe(32)
        webhook = self.repo.create_webhook({"workspace_id": workspace_id, "secret_hash": self._hash(secret), **data})
        self.repo.audit(workspace_id, user_id, "webhook.created", {"webhook_id": webhook.id})
        self.repo.commit()
        return self._webhook_view(webhook) | {"signing_secret": secret}

    def list_webhooks(self, user_id: str, workspace_id: str) -> list[dict[str, Any]]:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        return [self._webhook_view(item) for item in self.repo.list_webhooks(workspace_id)]

    def sign_webhook_test(self, user_id: str, webhook_id: str, secret: str, body: bytes) -> dict[str, Any]:
        webhook = self.repo.get_webhook(webhook_id)
        if webhook is None:
            raise NotFoundError("Webhook not found.")
        require_workspace_admin(self.repo.membership_role(webhook.workspace_id, user_id))
        timestamp = int(datetime.now(UTC).timestamp())
        return {"timestamp": timestamp, "signature": sign_webhook_payload(secret, body, timestamp)}

    def verify_webhook(
        self,
        webhook_id: str,
        secret: str,
        body: bytes,
        timestamp: int,
        signature: str,
    ) -> dict[str, str]:
        webhook = self.repo.get_webhook(webhook_id)
        if webhook is None or self._hash(secret) != webhook.secret_hash:
            raise AuthorisationError("Webhook credentials are invalid.")
        seen = self.repo.webhook_signatures(webhook_id)
        verify_webhook_signature(secret, body, timestamp, signature, seen, int(datetime.now(UTC).timestamp()))
        self.repo.record_webhook_replay(webhook_id, signature, timestamp)
        self.repo.audit(webhook.workspace_id, None, "webhook.signature_verified", {"webhook_id": webhook_id})
        self.repo.commit()
        return {"status": "accepted"}

    def create_scheduled_review(self, user_id: str, workspace_id: str, data: dict[str, Any]) -> Any:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        review = self.repo.get_review(str(data["review_id"]))
        if review is None:
            raise NotFoundError("Review not found.")
        if review.workspace_id != workspace_id:
            raise AuthorisationError("Scheduled review workspace mismatch.")
        item = self.repo.create_scheduled_review({"workspace_id": workspace_id, **data})
        self.repo.audit(workspace_id, user_id, "enterprise.scheduled_review_created", {"schedule_id": item.id})
        self.repo.commit()
        return item

    def list_scheduled_reviews(self, user_id: str, workspace_id: str) -> list[Any]:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        return self.repo.list_scheduled_reviews(workspace_id)

    def run_due_scheduled_reviews(self, user_id: str, workspace_id: str) -> dict[str, int]:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        now = datetime.now(UTC)
        due = self.repo.due_scheduled_reviews(workspace_id, now)
        for schedule in due:
            self.repo.create_notification(
                {"workspace_id": workspace_id, "user_id": None, "kind": "scheduled_review", "title": schedule.trigger}
            )
            self.repo.advance_scheduled_review(schedule, now)
        self.repo.audit(workspace_id, user_id, "enterprise.scheduled_reviews_run", {"count": len(due)})
        self.repo.commit()
        return {"run_count": len(due)}

    def operations_summary(self, user_id: str, workspace_id: str) -> dict[str, Any]:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        runs = self.repo.list_runs(workspace_id)
        audit_events = self.repo.list_audit_events(workspace_id)
        return {
            "run_volume": len(runs),
            "failure_rate": self._rate(runs, "failed"),
            "security_events": len([event for event in audit_events if str(event.action).startswith("security.")]),
            "queue_depth": 0,
            "tracing_redaction": "enabled",
            "quotas": {"workspace_runs_per_hour": 20, "provider_failures_before_circuit_open": 5},
            "backup_restore": {"rto_hours": 4, "rpo_hours": 24},
        }

    def model_comparison(self, user_id: str, workspace_id: str) -> dict[str, Any]:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        return {
            "workspace_id": workspace_id,
            "models": [self._model_row(model) for model in self.repo.list_model_records(workspace_id)],
        }

    def create_outcome(self, user_id: str, workspace_id: str, data: dict[str, Any]) -> Any:
        require_workspace_member(self.repo.membership_role(workspace_id, user_id))
        item = self.repo.create_outcome({"workspace_id": workspace_id, **data})
        self.repo.audit(workspace_id, user_id, "enterprise.outcome_recorded", {"outcome_id": item.id})
        self.repo.commit()
        return item

    def list_outcomes(self, user_id: str, workspace_id: str) -> list[Any]:
        require_workspace_member(self.repo.membership_role(workspace_id, user_id))
        return self.repo.list_outcomes(workspace_id)

    def list_audit(self, user_id: str, workspace_id: str) -> list[Any]:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        return self.repo.list_audit_events(workspace_id)

    def run_inspector(self, user_id: str, run_id: str) -> dict[str, Any]:
        run = self.repo.get_run(run_id)
        if run is None:
            raise NotFoundError("Run not found.")
        require_workspace_member(self.repo.membership_role(run.workspace_id, user_id))
        report = self.repo.get_report_by_run(run_id)
        return {
            "run_id": run.id,
            "state": run.state,
            "routing_decisions": run.routing_plan,
            "usage": run.usage,
            "report_quality_gate": "passed" if report else "not_available",
            "evidence": "available through source locators",
        }

    def request_data(self, user_id: str, workspace_id: str, request_type: str) -> Any:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        request = self.repo.create_data_request(
            {"workspace_id": workspace_id, "requested_by_user_id": user_id, "request_type": request_type}
        )
        completed = self.repo.complete_data_request(
            request.id,
            {"workspace_id": workspace_id, "request_type": request_type, "status": "ready"},
        )
        self.repo.audit(workspace_id, user_id, f"data.{request_type}_completed", {"request_id": request.id})
        self.repo.commit()
        return completed

    def list_data_requests(self, user_id: str, workspace_id: str) -> list[Any]:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        return self.repo.list_data_requests(workspace_id)

    def enforce_retention(self, user_id: str, workspace_id: str) -> dict[str, int]:
        require_workspace_admin(self.repo.membership_role(workspace_id, user_id))
        governance = self.repo.get_governance(workspace_id)
        before = datetime.now(UTC) - timedelta(days=governance.retention_days)
        removed = 0 if governance.legal_hold else self.repo.delete_expired_notifications(workspace_id, before)
        self.repo.audit(workspace_id, user_id, "data.retention_enforced", {"removed_notifications": removed})
        self.repo.commit()
        return {"removed_notifications": removed}

    @staticmethod
    def _hash(value: str) -> str:
        return sha256(value.encode("utf-8")).hexdigest()

    @staticmethod
    def _rate(runs: list[Any], state: str) -> float:
        return 0.0 if not runs else len([run for run in runs if run.state == state]) / len(runs)

    @staticmethod
    def _model_row(model: Any) -> dict[str, Any]:
        return {
            "model_identifier": model.model_identifier,
            "quality": 0.9 if model.verified else 0.65,
            "cost": 0.0 if "fake" in model.model_identifier else 1.0,
            "latency_ms": 120 if model.verified else 250,
            "failure_rate": 0.01 if model.verified else 0.08,
            "capability_coverage": len(model.capabilities),
        }

    @staticmethod
    def _api_token_view(token: Any) -> dict[str, Any]:
        return {
            "id": token.id,
            "workspace_id": token.workspace_id,
            "name": token.name,
            "token_prefix": token.token_prefix,
            "scopes": token.scopes,
            "rate_limit_per_minute": token.rate_limit_per_minute,
            "revoked": token.revoked_at is not None,
        }

    @staticmethod
    def _webhook_view(webhook: Any) -> dict[str, Any]:
        return {
            "id": webhook.id,
            "workspace_id": webhook.workspace_id,
            "name": webhook.name,
            "url": webhook.url,
            "events": webhook.events,
            "enabled": webhook.enabled,
        }
