from __future__ import annotations

from app.application.provider_governance import ProviderGovernanceService
from app.application.workflow_service import WorkflowService
from app.core.database import SessionLocal
from app.infrastructure.auth.credentials import FernetCredentialVault
from app.infrastructure.db.enterprise_repository import SqlEnterpriseRepository
from app.infrastructure.db.repositories import SqlRepository
from app.infrastructure.providers.adapters import ProviderRegistry


def execute_workflow_background(
    run_id: str,
    self_hosted_provider_mode: bool,
    allow_fake_provider: bool,
    app_secret_key: str,
    actor_user_id: str,
) -> None:
    with SessionLocal() as session:
        repo = SqlRepository(session)
        governance = ProviderGovernanceService(SqlEnterpriseRepository(session))
        service = WorkflowService(
            repo,
            ProviderRegistry(self_hosted_provider_mode, allow_fake_provider),
            governance,
            credential_vault=FernetCredentialVault(app_secret_key),
            allow_fake_provider=allow_fake_provider,
        )
        service.execute_run(run_id, actor_user_id)
