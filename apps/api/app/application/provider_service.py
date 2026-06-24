from __future__ import annotations

from typing import Any

from app.application.ports.providers import ProviderAdapter
from app.application.ports.repositories import RepositoryPorts
from app.domain.enums import WorkspaceRole
from app.domain.exceptions import AuthorisationError, NotFoundError, ValidationFailure
from app.domain.policies import require_admin


class ProviderService:
    def __init__(self, repo: RepositoryPorts, registry: Any) -> None:
        self.repo = repo
        self.registry = registry

    def adapter_schemas(self) -> list[dict[str, Any]]:
        return [
            {
                "key": schema.key,
                "label": schema.label,
                "fields": [field.__dict__ for field in schema.fields],
                "default_capabilities": schema.default_capabilities,
            }
            for schema in self.registry.schemas()
        ]

    def create_connection(self, user_id: str, workspace_id: str, data: dict[str, Any]) -> Any:
        role = self._role(user_id, workspace_id)
        require_admin(role)
        adapter = self._adapter(data["adapter"])
        result = adapter.test_connection(data.get("config", {}), data.get("credentials", {}))
        if not result["ok"]:
            raise ValidationFailure("Provider connection test failed.")
        connection = self.repo.create_provider_connection(
            workspace_id,
            {
                "adapter": data["adapter"],
                "name": data["name"],
                "config": data.get("config", {}),
                "encrypted_credentials": self._seal(data.get("credentials", {})),
            },
        )
        self.repo.audit(workspace_id, user_id, "provider.connection_created", {"adapter": data["adapter"]})
        self.repo.commit()
        return self._connection_view(connection)

    def list_connections(self, user_id: str, workspace_id: str) -> list[dict[str, Any]]:
        self._role(user_id, workspace_id)
        return [self._connection_view(item) for item in self.repo.list_provider_connections(workspace_id)]

    def test_connection(self, user_id: str, connection_id: str) -> dict[str, Any]:
        connection = self.repo.get_provider_connection(connection_id)
        if connection is None:
            raise NotFoundError("Provider connection not found.")
        self._role(user_id, connection.workspace_id)
        adapter = self._adapter(connection.adapter)
        return adapter.test_connection(connection.config, {"api_key": "__stored__"})

    def create_model(self, user_id: str, workspace_id: str, data: dict[str, Any]) -> Any:
        require_admin(self._role(user_id, workspace_id))
        connection = self.repo.get_provider_connection(data["provider_connection_id"])
        if connection is None or connection.workspace_id != workspace_id:
            raise NotFoundError("Provider connection not found.")
        model = self.repo.create_model(workspace_id, data)
        self.repo.audit(workspace_id, user_id, "provider.model_created", {"model_id": model.id})
        self.repo.commit()
        return model

    def list_models(self, user_id: str, workspace_id: str) -> list[Any]:
        self._role(user_id, workspace_id)
        return self.repo.list_models(workspace_id)

    def create_profile(self, user_id: str, workspace_id: str, data: dict[str, Any]) -> Any:
        require_admin(self._role(user_id, workspace_id))
        model = self.repo.get_model(data["model_record_id"])
        if model is None or model.workspace_id != workspace_id:
            raise NotFoundError("Model not found.")
        profile = self.repo.create_profile(workspace_id, data)
        self.repo.audit(workspace_id, user_id, "provider.profile_created", {"profile_id": profile.id})
        self.repo.commit()
        return profile

    def list_profiles(self, user_id: str, workspace_id: str) -> list[Any]:
        self._role(user_id, workspace_id)
        return self.repo.list_profiles(workspace_id)

    def _adapter(self, key: str) -> ProviderAdapter:
        try:
            return self.registry.get(key)
        except KeyError as exc:
            raise ValidationFailure("Unknown provider adapter.") from exc

    def _role(self, user_id: str, workspace_id: str) -> WorkspaceRole:
        role = self.repo.membership_role(workspace_id, user_id)
        if role is None:
            raise AuthorisationError("Workspace access denied.")
        return WorkspaceRole(role)

    @staticmethod
    def _seal(credentials: dict[str, str]) -> dict[str, str]:
        return {key: f"stored:{len(value)}" for key, value in credentials.items() if value}

    @staticmethod
    def _connection_view(connection: Any) -> dict[str, Any]:
        return {
            "id": connection.id,
            "workspace_id": connection.workspace_id,
            "adapter": connection.adapter,
            "name": connection.name,
            "config": connection.config,
            "has_credentials": bool(connection.encrypted_credentials),
        }
