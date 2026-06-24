from __future__ import annotations

from typing import Any

from app.application.ports.credentials import CredentialVault
from app.application.ports.providers import ProviderAdapter
from app.application.ports.repositories import RepositoryPorts
from app.application.provider_governance import ProviderGovernanceService
from app.domain.enums import WorkspaceRole
from app.domain.exceptions import AuthorisationError, NotFoundError, ValidationFailure
from app.domain.policies import require_admin


class ProviderService:
    def __init__(
        self,
        repo: RepositoryPorts,
        registry: Any,
        credential_vault: CredentialVault,
        governance: ProviderGovernanceService | None = None,
    ) -> None:
        self.repo = repo
        self.registry = registry
        self.credential_vault = credential_vault
        self.governance = governance

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
        self._validate_governance(workspace_id, data["adapter"], None, "provider_admin", user_id)
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
                "encrypted_credentials": self.credential_vault.seal(data.get("credentials", {})),
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
        return adapter.test_connection(connection.config, self._credentials(connection.encrypted_credentials))

    def sync_models(self, user_id: str, connection_id: str) -> list[Any]:
        connection = self.repo.get_provider_connection(connection_id)
        if connection is None:
            raise NotFoundError("Provider connection not found.")
        require_admin(self._role(user_id, connection.workspace_id))
        adapter = self._adapter(connection.adapter)
        synced: list[Any] = []
        for item in adapter.catalogue_models(connection.config, self._credentials(connection.encrypted_credentials)):
            self._validate_governance(
                connection.workspace_id,
                connection.adapter,
                str(item["model_identifier"]),
                "model_catalogue",
                user_id,
            )
            data = {
                "provider_connection_id": connection.id,
                "model_identifier": str(item["model_identifier"]),
                "capabilities": self._string_list(item.get("capabilities", [])),
                "provenance": str(item.get("provenance", f"adapter_catalogue:{connection.adapter}")),
                "verified": bool(item.get("verified", False)),
                "probe_result": self._dict_value(item.get("probe_result", {})),
            }
            existing = self.repo.get_model_by_identifier(
                connection.workspace_id,
                connection.id,
                data["model_identifier"],
            )
            if existing is None:
                synced.append(self.repo.create_model(connection.workspace_id, data))
            else:
                synced.append(
                    self.repo.update_model_probe(
                        existing.id,
                        data["capabilities"],
                        data["provenance"],
                        data["verified"],
                        data["probe_result"],
                    )
                )
        self.repo.audit(
            connection.workspace_id,
            user_id,
            "provider.models_synced",
            {"connection_id": connection.id, "count": len(synced)},
        )
        self.repo.commit()
        return synced

    def create_model(self, user_id: str, workspace_id: str, data: dict[str, Any]) -> Any:
        require_admin(self._role(user_id, workspace_id))
        connection = self.repo.get_provider_connection(data["provider_connection_id"])
        if connection is None or connection.workspace_id != workspace_id:
            raise NotFoundError("Provider connection not found.")
        self._validate_governance(
            workspace_id,
            connection.adapter,
            str(data["model_identifier"]),
            "model_registration",
            user_id,
        )
        model = self.repo.create_model(workspace_id, data)
        self.repo.audit(workspace_id, user_id, "provider.model_created", {"model_id": model.id})
        self.repo.commit()
        return model

    def list_models(self, user_id: str, workspace_id: str) -> list[Any]:
        self._role(user_id, workspace_id)
        return self.repo.list_models(workspace_id)

    def probe_model(self, user_id: str, model_id: str) -> Any:
        model = self.repo.get_model(model_id)
        if model is None:
            raise NotFoundError("Model not found.")
        require_admin(self._role(user_id, model.workspace_id))
        connection = self.repo.get_provider_connection(model.provider_connection_id)
        if connection is None or connection.workspace_id != model.workspace_id:
            raise NotFoundError("Provider connection not found.")
        result = self._adapter(connection.adapter).probe_capabilities(model.model_identifier, model.capabilities)
        verified = bool(result.get("ok", False))
        capabilities = self._string_list(result.get("verified_capabilities", model.capabilities))
        next_model = self.repo.update_model_probe(
            model.id,
            capabilities or model.capabilities,
            f"probe:{connection.adapter}",
            verified,
            self._dict_value(result),
        )
        self.repo.audit(model.workspace_id, user_id, "provider.model_probed", {"model_id": model.id})
        self.repo.commit()
        return next_model

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

    def _validate_governance(
        self,
        workspace_id: str,
        provider: str,
        model_identifier: str | None,
        purpose: str,
        actor_user_id: str,
    ) -> None:
        if self.governance is None:
            return
        self.governance.validate_route(
            workspace_id,
            provider,
            model_identifier,
            "internal",
            "global",
            purpose,
            actor_user_id,
        )

    def _role(self, user_id: str, workspace_id: str) -> WorkspaceRole:
        role = self.repo.membership_role(workspace_id, user_id)
        if role is None:
            raise AuthorisationError("Workspace access denied.")
        return WorkspaceRole(role)

    def _credentials(self, sealed_credentials: dict[str, str]) -> dict[str, str]:
        try:
            return self.credential_vault.unseal(sealed_credentials)
        except ValueError as exc:
            raise ValidationFailure("Stored provider credentials could not be decrypted.") from exc

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

    @staticmethod
    def _string_list(value: object) -> list[str]:
        if not isinstance(value, list):
            return []
        return [str(item) for item in value]

    @staticmethod
    def _dict_value(value: object) -> dict[str, Any]:
        return value if isinstance(value, dict) else {}
