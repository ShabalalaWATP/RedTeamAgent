from __future__ import annotations

from typing import Any

from app.application.enterprise_policy import enforce_allowlist, normalised_list


class ProviderGovernanceService:
    def __init__(self, repo: Any) -> None:
        self.repo = repo

    def validate_route(
        self,
        workspace_id: str,
        provider: str,
        model_identifier: str | None,
        data_classification: str,
        region: str,
        purpose: str,
        actor_user_id: str | None,
    ) -> None:
        governance = self.repo.get_governance(workspace_id)
        enforce_allowlist("Provider", provider, normalised_list(governance.provider_allowlist))
        if model_identifier:
            enforce_allowlist("Model", model_identifier, normalised_list(governance.model_allowlist))
        enforce_allowlist(
            "Data classification",
            data_classification,
            normalised_list(governance.data_classification_allowlist),
        )
        enforce_allowlist("Region", region, normalised_list(governance.region_allowlist))
        enforce_allowlist("Task purpose", purpose, normalised_list(governance.purpose_allowlist))
        self.repo.audit(
            workspace_id,
            actor_user_id,
            "provider.route_policy_allowed",
            {
                "provider": provider,
                "model_identifier": model_identifier or "",
                "data_classification": data_classification,
                "region": region,
                "purpose": purpose,
            },
        )
