from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ModelRoute:
    provider: str
    model_identifier: str
    model_record_id: str
    provider_connection_id: str
    model_profile: str
    explicit_pin: bool
    config: dict[str, Any]
    encrypted_credentials: dict[str, str]

    def metadata(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "model_identifier": self.model_identifier,
            "model_record_id": self.model_record_id,
            "provider_connection_id": self.provider_connection_id,
            "model_profile": self.model_profile,
            "explicit_pin": self.explicit_pin,
        }


def select_model_route(repo: Any, workspace_id: str, agent_keys: list[str]) -> ModelRoute | None:
    models = {model.id: model for model in repo.list_models(workspace_id) if getattr(model, "verified", False)}
    if not models:
        return None
    profiles = repo.list_profiles(workspace_id)
    for agent_key in [*agent_keys, "default", "all", "*"]:
        for profile in profiles:
            if profile.agent_key == agent_key and profile.model_record_id in models:
                route = _route_for_model(repo, workspace_id, models[profile.model_record_id], profile)
                if route is not None:
                    return route
    return None


def _route_for_model(repo: Any, workspace_id: str, model: Any, profile: Any) -> ModelRoute | None:
    connection = repo.get_provider_connection(model.provider_connection_id)
    if connection is None or connection.workspace_id != workspace_id:
        return None
    return ModelRoute(
        provider=connection.adapter,
        model_identifier=model.model_identifier,
        model_record_id=model.id,
        provider_connection_id=connection.id,
        model_profile=profile.name,
        explicit_pin=bool(getattr(profile, "explicit_pin", False)),
        config=dict(connection.config or {}),
        encrypted_credentials=dict(connection.encrypted_credentials or {}),
    )
