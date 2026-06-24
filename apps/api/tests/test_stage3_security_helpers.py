from __future__ import annotations

import pytest

from app import worker
from app.application import enterprise_policy
from app.application.webhook_security import sign_webhook_payload, verify_webhook_signature
from app.domain.exceptions import AuthorisationError, ProviderPolicyError, ValidationFailure


def test_stage3_policy_helpers_and_worker_shutdown(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert enterprise_policy.normalised_list("not-list") == []
    with pytest.raises(AuthorisationError):
        enterprise_policy.require_workspace_member(None)
    with pytest.raises(AuthorisationError):
        enterprise_policy.require_project_write("viewer", None)
    with pytest.raises(ValidationFailure):
        enterprise_policy.validate_custom_agent("safe", ["unrestricted_tools"], {"type": "object"})
    with pytest.raises(ValidationFailure):
        enterprise_policy.validate_custom_agent("safe", [], {})
    with pytest.raises(ProviderPolicyError):
        enterprise_policy.enforce_allowlist("Provider", "fake", ["openai"])

    body = b'{"event":"run.completed"}'
    signature = sign_webhook_payload("secret", body, 100)
    with pytest.raises(ValidationFailure):
        verify_webhook_signature("secret", body, 100, signature, set(), 5000)
    with pytest.raises(AuthorisationError):
        verify_webhook_signature("secret", body, 1000, "bad", set(), 1000)

    worker._running = True
    monkeypatch.setattr(worker.signal, "signal", lambda *_args: None)
    monkeypatch.setattr(worker.time, "sleep", lambda _seconds: worker._request_shutdown(0, None))
    worker.main()
    output = capsys.readouterr().out
    assert "worker ready" in output
    assert "worker stopped" in output
