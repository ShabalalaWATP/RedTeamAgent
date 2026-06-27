from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.infrastructure.db import models


class ProviderRepositoryMixin:
    session: Session

    def create_provider_connection(self, workspace_id: str, data: dict[str, Any]) -> models.ProviderConnection:
        connection = models.ProviderConnection(workspace_id=workspace_id, **data)
        self.session.add(connection)
        self.session.flush()
        return connection

    def get_provider_connection(self, connection_id: str) -> models.ProviderConnection | None:
        return self.session.get(models.ProviderConnection, connection_id)

    def list_provider_connections(self, workspace_id: str) -> list[models.ProviderConnection]:
        statement = select(models.ProviderConnection).where(
            models.ProviderConnection.workspace_id == workspace_id
        )
        return list(self.session.scalars(statement))

    def create_model(self, workspace_id: str, data: dict[str, Any]) -> models.ModelRecord:
        model = models.ModelRecord(workspace_id=workspace_id, **data)
        self.session.add(model)
        self.session.flush()
        return model

    def get_model(self, model_id: str) -> models.ModelRecord | None:
        return self.session.get(models.ModelRecord, model_id)

    def get_model_by_identifier(
        self,
        workspace_id: str,
        provider_connection_id: str,
        model_identifier: str,
    ) -> models.ModelRecord | None:
        statement = select(models.ModelRecord).where(
            models.ModelRecord.workspace_id == workspace_id,
            models.ModelRecord.provider_connection_id == provider_connection_id,
            models.ModelRecord.model_identifier == model_identifier,
        )
        return self.session.scalar(statement)

    def list_models(self, workspace_id: str) -> list[models.ModelRecord]:
        statement = select(models.ModelRecord).where(models.ModelRecord.workspace_id == workspace_id)
        return list(self.session.scalars(statement))

    def update_model_probe(
        self,
        model_id: str,
        capabilities: list[str],
        provenance: str,
        verified: bool,
        probe_result: dict[str, Any],
    ) -> models.ModelRecord:
        model = self.session.get(models.ModelRecord, model_id)
        if model is None:
            raise LookupError(model_id)
        model.capabilities = capabilities
        model.provenance = provenance
        model.verified = verified
        model.probe_result = probe_result
        return model

    def create_profile(self, workspace_id: str, data: dict[str, Any]) -> models.ModelProfile:
        profile = models.ModelProfile(workspace_id=workspace_id, **data)
        self.session.add(profile)
        self.session.flush()
        return profile

    def list_profiles(self, workspace_id: str) -> list[models.ModelProfile]:
        statement = select(models.ModelProfile).where(models.ModelProfile.workspace_id == workspace_id)
        return list(self.session.scalars(statement))
