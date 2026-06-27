from __future__ import annotations

from typing import Any

from app.infrastructure.workflow import background


def test_background_workflow_preserves_provider_registry_settings(monkeypatch) -> None:
    seen: dict[str, Any] = {}

    class FakeSession:
        def __enter__(self) -> FakeSession:
            return self

        def __exit__(self, *args: object) -> None:
            del args

    class FakeRegistry:
        def __init__(self, self_hosted_mode: bool, allow_fake_provider: bool) -> None:
            seen["registry"] = {
                "self_hosted_mode": self_hosted_mode,
                "allow_fake_provider": allow_fake_provider,
            }

    class FakeWorkflowService:
        def __init__(self, repo: object, registry: object, governance: object) -> None:
            seen["service"] = (repo, registry, governance)

        def execute_run(self, run_id: str, actor_user_id: str) -> None:
            seen["run"] = (run_id, actor_user_id)

    monkeypatch.setattr(background, "SessionLocal", lambda: FakeSession())
    monkeypatch.setattr(background, "SqlRepository", lambda session: "repo")
    monkeypatch.setattr(background, "SqlEnterpriseRepository", lambda session: "enterprise-repo")
    monkeypatch.setattr(background, "ProviderGovernanceService", lambda repo: "governance")
    monkeypatch.setattr(background, "ProviderRegistry", FakeRegistry)
    monkeypatch.setattr(background, "WorkflowService", FakeWorkflowService)

    background.execute_workflow_background("run-1", False, False, "user-1")

    assert seen["registry"] == {"self_hosted_mode": False, "allow_fake_provider": False}
    assert seen["run"] == ("run-1", "user-1")
