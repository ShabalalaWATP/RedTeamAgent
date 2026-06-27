from __future__ import annotations

from sqlalchemy.orm import Session

from app.infrastructure.db.repositories_audit import AuditRepositoryMixin
from app.infrastructure.db.repositories_identity import IdentityRepositoryMixin
from app.infrastructure.db.repositories_providers import ProviderRepositoryMixin
from app.infrastructure.db.repositories_reviews import ReviewRepositoryMixin
from app.infrastructure.db.repositories_workflows import WorkflowRepositoryMixin


class SqlRepository(
    IdentityRepositoryMixin,
    ReviewRepositoryMixin,
    ProviderRepositoryMixin,
    WorkflowRepositoryMixin,
    AuditRepositoryMixin,
):
    def __init__(self, session: Session) -> None:
        self.session = session
