from __future__ import annotations

from types import SimpleNamespace

import pytest
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.exceptions import InvalidAuthenticationResponse

from app.application.passkey_service import PasskeyService
from app.domain.exceptions import AuthenticationError, ConflictError, NotFoundError, ValidationFailure


def test_passkey_service_registers_and_verifies_session(monkeypatch: pytest.MonkeyPatch) -> None:
    repo = FakePasskeyRepo()
    service = PasskeyService(repo, "https://redteamagent.co.uk", "", "RedTeamAgent")

    options = service.registration_options(repo.user, repo.session.id)
    assert options["rp"]["id"] == "redteamagent.co.uk"
    assert repo.challenges["registration"]

    monkeypatch.setattr(
        "app.application.passkey_service.verify_registration_response",
        lambda **_: SimpleNamespace(
            credential_id=b"credential-1",
            credential_public_key=b"public-key",
            sign_count=1,
            aaguid="test-aaguid",
        ),
    )
    service.verify_registration(
        repo.user.id,
        repo.session.id,
        {"rawId": "ignored", "response": {"transports": ["internal", 123]}},
        "Laptop",
    )

    assert repo.passkeys[0].name == "Laptop"
    assert repo.passkeys[0].credential_id == bytes_to_base64url(b"credential-1")
    assert repo.passkeys[0].transports == ["internal"]
    assert repo.session.passkey_verified_at is not None
    assert repo.challenges["registration"] is None

    auth_options = service.authentication_options(repo.user.id, repo.session.id)
    assert auth_options["userVerification"] == "required"
    assert repo.challenges["authentication"]

    monkeypatch.setattr(
        "app.application.passkey_service.verify_authentication_response",
        lambda **_: SimpleNamespace(credential_id=b"credential-1", new_sign_count=2),
    )
    service.verify_authentication(
        repo.user.id,
        repo.session.id,
        {"rawId": bytes_to_base64url(b"credential-1")},
    )

    assert repo.passkeys[0].sign_count == 2
    assert repo.passkeys[0].last_used_at is not None
    assert repo.challenges["authentication"] is None
    assert "auth.passkey_verified" in repo.audit_actions


def test_passkey_service_reports_requirements_and_rejects_missing_challenges() -> None:
    repo = FakePasskeyRepo()
    service = PasskeyService(repo, "https://redteamagent.co.uk", "", "RedTeamAgent")

    requirements = service.requirements(repo.user.id, repo.session.id, "owner")
    assert requirements["setup_required"] is True
    assert service.status(repo.user.id, repo.session.id, "user")["required"] is False

    with pytest.raises(AuthenticationError):
        service.verify_registration(repo.user.id, repo.session.id, {"rawId": "missing"}, None)

    with pytest.raises(ValidationFailure):
        service.authentication_options(repo.user.id, repo.session.id)

    repo.passkeys.append(
        SimpleNamespace(
            id="passkey-duplicate",
            user_id=repo.user.id,
            name="Duplicate",
            credential_id=bytes_to_base64url(b"duplicate"),
            public_key=bytes_to_base64url(b"public-key"),
            sign_count=0,
            transports=[],
            created_at=repo.now,
            last_used_at=None,
        )
    )
    with pytest.raises(AuthenticationError):
        service.verify_authentication(repo.user.id, repo.session.id, {"rawId": bytes_to_base64url(b"duplicate")})

    repo.challenges["authentication"] = bytes_to_base64url(b"challenge")
    with pytest.raises(ValidationFailure):
        service.verify_authentication(repo.user.id, repo.session.id, {})

    with pytest.raises(RuntimeError):
        PasskeyService(repo, "redteamagent.co.uk", "", "RedTeamAgent")


def test_passkey_service_rejects_duplicate_registration(monkeypatch: pytest.MonkeyPatch) -> None:
    repo = FakePasskeyRepo()
    service = PasskeyService(repo, "https://redteamagent.co.uk", "", "RedTeamAgent")
    credential_id = bytes_to_base64url(b"duplicate")
    repo.passkeys.append(
        SimpleNamespace(
            id="passkey-1",
            user_id=repo.user.id,
            name="Existing",
            credential_id=credential_id,
            public_key=bytes_to_base64url(b"public-key"),
            sign_count=0,
            transports=[],
            created_at=repo.now,
            last_used_at=None,
        )
    )
    repo.challenges["registration"] = bytes_to_base64url(b"challenge")
    monkeypatch.setattr(
        "app.application.passkey_service.verify_registration_response",
        lambda **_: SimpleNamespace(
            credential_id=b"duplicate",
            credential_public_key=b"public-key",
            sign_count=1,
            aaguid="test-aaguid",
        ),
    )

    with pytest.raises(ConflictError):
        service.verify_registration(
            repo.user.id,
            repo.session.id,
            {"rawId": "ignored", "response": {"transports": "internal"}},
            None,
        )


def test_registration_options_allow_replacement_before_session_verification() -> None:
    repo = FakePasskeyRepo()
    service = PasskeyService(repo, "https://redteamagent.co.uk", "", "RedTeamAgent")
    repo.passkeys.append(_fake_passkey(repo, "passkey-1", repo.user.id))

    recovery_options = service.registration_options(repo.user, repo.session.id)

    assert recovery_options["excludeCredentials"] == []
    assert recovery_options["user"]["id"] != bytes_to_base64url(repo.user.id.encode("utf-8"))
    assert len(base64url_to_bytes(recovery_options["user"]["id"])) <= 64

    repo.session.passkey_verified_at = repo.now
    normal_options = service.registration_options(repo.user, repo.session.id)

    assert normal_options["excludeCredentials"] == [{"id": bytes_to_base64url(b"passkey-1"), "type": "public-key"}]
    assert normal_options["user"]["id"] == bytes_to_base64url(repo.user.id.encode("utf-8"))


def test_passkey_service_accepts_origin_aliases_and_wraps_library_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repo = FakePasskeyRepo()
    service = PasskeyService(
        repo,
        "https://redteamagent.co.uk",
        "redteamagent.co.uk",
        "RedTeamAgent",
        "https://www.redteamagent.co.uk",
    )
    repo.passkeys.append(_fake_passkey(repo, "passkey-1", repo.user.id))
    repo.challenges["authentication"] = bytes_to_base64url(b"challenge")
    seen: dict[str, object] = {}

    def verified_authentication(**kwargs: object) -> SimpleNamespace:
        seen["expected_origin"] = kwargs["expected_origin"]
        return SimpleNamespace(credential_id=b"passkey-1", new_sign_count=2)

    monkeypatch.setattr("app.application.passkey_service.verify_authentication_response", verified_authentication)
    service.verify_authentication(repo.user.id, repo.session.id, {"rawId": bytes_to_base64url(b"passkey-1")})

    assert seen["expected_origin"] == ["https://redteamagent.co.uk", "https://www.redteamagent.co.uk"]

    repo.challenges["authentication"] = bytes_to_base64url(b"challenge")
    monkeypatch.setattr(
        "app.application.passkey_service.verify_authentication_response",
        lambda **_: (_ for _ in ()).throw(InvalidAuthenticationResponse("bad origin")),
    )
    with pytest.raises(AuthenticationError, match="Passkey verification failed"):
        service.verify_authentication(repo.user.id, repo.session.id, {"rawId": bytes_to_base64url(b"passkey-1")})


def test_passkey_service_keeps_registration_without_transport_list(monkeypatch: pytest.MonkeyPatch) -> None:
    repo = FakePasskeyRepo()
    service = PasskeyService(repo, "https://redteamagent.co.uk", "", "RedTeamAgent")
    repo.challenges["registration"] = bytes_to_base64url(b"challenge")
    monkeypatch.setattr(
        "app.application.passkey_service.verify_registration_response",
        lambda **_: SimpleNamespace(
            credential_id=b"credential-2",
            credential_public_key=b"public-key",
            sign_count=1,
            aaguid="test-aaguid",
        ),
    )

    service.verify_registration(
        repo.user.id,
        repo.session.id,
        {"rawId": "ignored", "response": {"transports": "internal"}},
        "",
    )

    assert repo.passkeys[0].name == "Passkey"
    assert repo.passkeys[0].transports == []


def test_passkey_service_rejects_other_users_credential() -> None:
    repo = FakePasskeyRepo()
    service = PasskeyService(repo, "https://redteamagent.co.uk", "", "RedTeamAgent")
    repo.passkeys.append(
        SimpleNamespace(
            id="passkey-1",
            user_id="other-user",
            name="Other",
            credential_id=bytes_to_base64url(b"other"),
            public_key=bytes_to_base64url(b"public-key"),
            sign_count=0,
            transports=[],
            created_at=repo.now,
            last_used_at=None,
        )
    )
    repo.challenges["authentication"] = bytes_to_base64url(b"challenge")
    with pytest.raises(AuthenticationError):
        service.verify_authentication(repo.user.id, repo.session.id, {"rawId": bytes_to_base64url(b"other")})


def test_passkey_service_deletes_passkeys_and_keeps_required_last_passkey() -> None:
    repo = FakePasskeyRepo()
    service = PasskeyService(repo, "https://redteamagent.co.uk", "", "RedTeamAgent")
    repo.passkeys.extend(
        [
            _fake_passkey(repo, "passkey-1", repo.user.id),
            _fake_passkey(repo, "passkey-2", repo.user.id),
            _fake_passkey(repo, "passkey-other", "other-user"),
        ]
    )

    service.delete_passkey(repo.user.id, "passkey-1", "owner", True)

    assert [item.id for item in repo.passkeys] == ["passkey-2", "passkey-other"]
    assert "auth.passkey_deleted" in repo.audit_actions

    with pytest.raises(ConflictError):
        service.delete_passkey(repo.user.id, "passkey-2", "admin", True)

    with pytest.raises(NotFoundError):
        service.delete_passkey(repo.user.id, "passkey-other", "user", False)

    service.delete_passkey(repo.user.id, "passkey-2", "user", False)
    assert [item.id for item in repo.passkeys] == ["passkey-other"]


def _fake_passkey(repo: FakePasskeyRepo, passkey_id: str, user_id: str) -> SimpleNamespace:
    return SimpleNamespace(
        id=passkey_id,
        user_id=user_id,
        name="Laptop",
        credential_id=bytes_to_base64url(passkey_id.encode("utf-8")),
        public_key=bytes_to_base64url(b"public-key"),
        sign_count=0,
        transports=[],
        created_at=repo.now,
        last_used_at=None,
    )


class FakePasskeyRepo:
    def __init__(self) -> None:
        self.now = SimpleNamespace()
        self.user = SimpleNamespace(id="user-1", email="owner@example.com")
        self.session = SimpleNamespace(id="session-1", passkey_verified_at=None)
        self.passkeys: list[SimpleNamespace] = []
        self.challenges: dict[str, str | None] = {}
        self.audit_actions: list[str] = []
        self.commits = 0
        self.mfa_setting = SimpleNamespace(enabled=False)

    def count_user_passkeys(self, user_id: str) -> int:
        return len(self.list_user_passkeys(user_id))

    def list_user_passkeys(self, user_id: str) -> list[SimpleNamespace]:
        return [item for item in self.passkeys if item.user_id == user_id]

    def get_session(self, session_id: str) -> SimpleNamespace | None:
        return self.session if session_id == self.session.id else None

    def get_mfa_setting(self, user_id: str) -> SimpleNamespace:
        return self.mfa_setting

    def set_session_passkey_challenge(self, session_id: str, purpose: str, challenge: str | None) -> None:
        assert session_id == self.session.id
        self.challenges[purpose] = challenge

    def get_session_passkey_challenge(self, session_id: str, purpose: str) -> str | None:
        assert session_id == self.session.id
        return self.challenges.get(purpose)

    def get_passkey_by_credential_id(self, credential_id: str) -> SimpleNamespace | None:
        return next((item for item in self.passkeys if item.credential_id == credential_id), None)

    def get_passkey(self, passkey_id: str) -> SimpleNamespace | None:
        return next((item for item in self.passkeys if item.id == passkey_id), None)

    def create_passkey(
        self,
        user_id: str,
        name: str,
        credential_id: str,
        public_key: str,
        sign_count: int,
        transports: list[str],
        aaguid: str,
    ) -> SimpleNamespace:
        passkey = SimpleNamespace(
            id="passkey-1",
            user_id=user_id,
            name=name,
            credential_id=credential_id,
            public_key=public_key,
            sign_count=sign_count,
            transports=transports,
            aaguid=aaguid,
            created_at=self.now,
            last_used_at=None,
        )
        self.passkeys.append(passkey)
        return passkey

    def mark_session_passkey_verified(self, session_id: str) -> None:
        assert session_id == self.session.id
        self.session.passkey_verified_at = self.now
        self.challenges["authentication"] = None

    def update_passkey_usage(self, passkey_id: str, sign_count: int) -> None:
        passkey = next(item for item in self.passkeys if item.id == passkey_id)
        passkey.sign_count = sign_count
        passkey.last_used_at = self.now

    def delete_passkey(self, passkey_id: str) -> None:
        self.passkeys = [item for item in self.passkeys if item.id != passkey_id]

    def audit(
        self,
        workspace_id: str | None,
        actor_user_id: str | None,
        action: str,
        metadata: dict[str, object],
    ) -> None:
        del workspace_id, actor_user_id, metadata
        self.audit_actions.append(action)

    def commit(self) -> None:
        self.commits += 1
