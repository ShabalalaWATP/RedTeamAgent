from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.infrastructure.db import models


class AuditRepositoryMixin:
    session: Session

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
