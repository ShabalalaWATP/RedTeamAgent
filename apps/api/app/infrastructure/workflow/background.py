from __future__ import annotations

from app.application.workflow_service import WorkflowService
from app.core.database import SessionLocal
from app.infrastructure.db.repositories import SqlRepository
from app.infrastructure.providers.adapters import ProviderRegistry


def execute_workflow_background(run_id: str, self_hosted_provider_mode: bool, actor_user_id: str) -> None:
    with SessionLocal() as session:
        repo = SqlRepository(session)
        service = WorkflowService(repo, ProviderRegistry(self_hosted_provider_mode))
        service.execute_run(run_id, actor_user_id)
