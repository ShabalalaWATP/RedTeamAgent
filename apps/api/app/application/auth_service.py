from __future__ import annotations

import secrets
from datetime import UTC, datetime
from hashlib import sha256
from typing import Any

from app.application.ports.notifications import EmailSender
from app.application.ports.repositories import RepositoryPorts
from app.domain.exceptions import (
    AuthenticationError,
    AuthorisationError,
    MfaRequiredError,
    NotFoundError,
    ValidationFailure,
)


class AuthService:
    def __init__(
        self,
        repo: RepositoryPorts,
        password_service: Any,
        token_service: Any,
        email_sender: EmailSender,
        public_app_url: str,
        expose_tokens: bool,
        mfa_service: Any,
        site_owner_bootstrap_token: str | None = None,
        auto_bootstrap_site_owner: bool = False,
    ) -> None:
        self.repo = repo
        self.passwords = password_service
        self.tokens = token_service
        self.email_sender = email_sender
        self.public_app_url = public_app_url.rstrip("/")
        self.expose_tokens = expose_tokens
        self.mfa = mfa_service
        self.site_owner_bootstrap_token = site_owner_bootstrap_token or ""
        self.auto_bootstrap_site_owner = auto_bootstrap_site_owner

    def register(self, email: str, password: str, site_owner_bootstrap_token: str | None = None) -> dict[str, Any]:
        self._validate_password(password)
        existing = self.repo.get_user_by_email(email)
        if existing:
            self.repo.audit(None, existing.id, "auth.registration_duplicate", {})
            self.repo.commit()
            return {"verification_token": None}  # nosec B105
        account_type = self._registration_account_type(site_owner_bootstrap_token)
        user = self.repo.create_user(email, self.passwords.hash(password), account_type=account_type)
        workspace = self.repo.create_personal_workspace(user.id, user.email)
        token = self.tokens.sign("verify-email", user.id)
        self._send_verification_email(user.email, token)
        self.repo.audit(workspace.id, user.id, "auth.registered", {"email": user.email})
        self.repo.commit()
        return {
            "verification_token": token if self.expose_tokens else None,
        }

    def verify_email(self, token: str) -> None:
        try:
            user_id = self.tokens.verify("verify-email", token, 60 * 60 * 24)
        except ValueError as exc:
            raise AuthenticationError("Invalid verification token.") from exc
        if not self.repo.get_user(user_id):
            raise NotFoundError("User not found.")
        self.repo.verify_user(user_id)
        self.repo.audit(None, user_id, "auth.email_verified", {})
        self.repo.commit()

    def login(
        self,
        email: str,
        password: str,
        csrf_token: str,
        mfa_code: str | None = None,
        remote_ip: str | None = None,
    ) -> dict[str, Any]:
        user = self.repo.get_user_by_email(email)
        if user is None or not self.passwords.verify(user.password_hash, password):
            self.repo.audit(None, None, "auth.login_failed", {"reason": "invalid_credentials"})
            self.repo.commit()
            raise AuthenticationError("Invalid email or password.")
        try:
            self._require_active_user(user)
        except AuthenticationError:
            self.repo.audit(None, user.id, "auth.login_failed", {"reason": user.account_status})
            self.repo.commit()
            raise
        if not user.is_verified:
            self.repo.audit(None, user.id, "auth.login_failed", {"reason": "email_unverified"})
            self.repo.commit()
            raise AuthenticationError("Email must be verified before login.")
        if self.mfa.is_enabled(user.id) and not self.mfa.verify_login_code(user.id, mfa_code):
            self.repo.audit(None, user.id, "auth.login_failed", {"reason": "mfa_required"})
            self.repo.commit()
            raise MfaRequiredError("Multi-factor authentication code required.")
        session = self.repo.create_session(user.id, csrf_token)
        user.last_login_at = datetime.now(UTC)
        user.last_login_ip = remote_ip
        user.last_seen_at = user.last_login_at
        user.last_seen_ip = remote_ip
        workspace = self.repo.list_workspaces(user.id)[0]
        workspace_role = self.repo.membership_role(workspace.id, user.id)
        self.repo.audit(workspace.id, user.id, "auth.login", {})
        self.repo.commit()
        return {
            "user": user,
            "session": session,
            "csrf_token": csrf_token,
            "workspace": workspace,
            "workspace_role": workspace_role,
        }

    def logout(self, session_id: str, user_id: str | None) -> None:
        self.repo.delete_session(session_id)
        self.repo.audit(None, user_id, "auth.logout", {})
        self.repo.commit()

    def request_password_reset(self, email: str) -> dict[str, str]:
        user = self.repo.get_user_by_email(email)
        if user is None:
            return {"reset_token": ""}  # nosec
        token = self.tokens.sign("password-reset", self._password_reset_value(user))
        self._send_password_reset_email(user.email, token)
        self.repo.audit(None, user.id, "auth.password_reset_requested", {})
        self.repo.commit()
        return {"reset_token": token if self.expose_tokens else ""}

    def confirm_password_reset(self, token: str, password: str) -> None:
        self._validate_password(password)
        try:
            reset_value = self.tokens.verify("password-reset", token, 60 * 30)
            user_id, password_fingerprint = reset_value.rsplit(":", 1)
        except ValueError as exc:
            raise AuthenticationError("Invalid password reset token.") from exc
        user = self.repo.get_user(user_id)
        if user is None:
            raise NotFoundError("User not found.")
        if not secrets.compare_digest(password_fingerprint, self._password_fingerprint(user.password_hash)):
            raise AuthenticationError("Invalid password reset token.")
        self.repo.update_password(user_id, self.passwords.hash(password))
        self.repo.delete_user_sessions(user_id)
        self.repo.audit(None, user_id, "auth.password_reset_confirmed", {})
        self.repo.commit()

    def _registration_account_type(self, site_owner_bootstrap_token: str | None) -> str:
        if self.repo.has_site_owner():
            return "user"
        if self.auto_bootstrap_site_owner and not site_owner_bootstrap_token:
            return "owner"
        if site_owner_bootstrap_token:
            if self.site_owner_bootstrap_token and secrets.compare_digest(
                site_owner_bootstrap_token,
                self.site_owner_bootstrap_token,
            ):
                return "owner"
            raise AuthorisationError("Site owner bootstrap token is invalid.")
        return "user"

    def _password_reset_value(self, user: Any) -> str:
        return f"{user.id}:{self._password_fingerprint(user.password_hash)}"

    @staticmethod
    def _password_fingerprint(password_hash: str) -> str:
        return sha256(password_hash.encode("utf-8")).hexdigest()

    @staticmethod
    def _validate_password(password: str) -> None:
        missing: list[str] = []
        if len(password) < 12:
            missing.append("be at least 12 characters")
        if len(password) > 128:
            missing.append("be no more than 128 characters")
        if not any(character.islower() for character in password):
            missing.append("include a lowercase letter")
        if not any(character.isupper() for character in password):
            missing.append("include an uppercase letter")
        if not any(character.isdigit() for character in password):
            missing.append("include a number")
        if not any(not character.isalnum() and not character.isspace() for character in password):
            missing.append("include a symbol")
        if password != password.strip():
            missing.append("not start or end with a space")
        if missing:
            raise ValidationFailure(f"Password must {', '.join(missing)}.")

    @staticmethod
    def _require_active_user(user: Any) -> None:
        status = str(getattr(user, "account_status", "active"))
        if status == "active":
            return
        default = {
            "suspended": "Your account has been suspended.",
            "banned": "Your account has been banned.",
            "deleted": "This account has been deleted.",
        }.get(status, "This account is not active.")
        message = str(getattr(user, "status_message", "") or default)
        raise AuthenticationError(message)

    def _send_verification_email(self, email: str, token: str) -> None:
        link = f"{self.public_app_url}/auth?verification_token={token}"
        self.email_sender.send(
            email,
            "Verify your RedTeamAgent email",
            f"Verify your RedTeamAgent account:\n\n{link}\n",
        )

    def _send_password_reset_email(self, email: str, token: str) -> None:
        link = f"{self.public_app_url}/auth?reset_token={token}"
        self.email_sender.send(
            email,
            "Reset your RedTeamAgent password",
            f"Reset your RedTeamAgent password:\n\n{link}\n",
        )
