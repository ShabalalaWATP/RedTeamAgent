from __future__ import annotations

from typing import Any

from app.application.ports.notifications import EmailSender
from app.application.ports.repositories import RepositoryPorts
from app.domain.exceptions import AuthenticationError, ConflictError, NotFoundError, ValidationFailure


class AuthService:
    def __init__(
        self,
        repo: RepositoryPorts,
        password_service: Any,
        token_service: Any,
        email_sender: EmailSender,
        public_app_url: str,
        expose_tokens: bool,
    ) -> None:
        self.repo = repo
        self.passwords = password_service
        self.tokens = token_service
        self.email_sender = email_sender
        self.public_app_url = public_app_url.rstrip("/")
        self.expose_tokens = expose_tokens

    def register(self, email: str, password: str) -> dict[str, Any]:
        self._validate_password(password)
        if self.repo.get_user_by_email(email):
            raise ConflictError("A user with this email already exists.")
        user = self.repo.create_user(email, self.passwords.hash(password))
        workspace = self.repo.create_personal_workspace(user.id, user.email)
        token = self.tokens.sign("verify-email", user.id)
        self._send_verification_email(user.email, token)
        self.repo.audit(workspace.id, user.id, "auth.registered", {"email": user.email})
        self.repo.commit()
        return {
            "user": user,
            "workspace": workspace,
            "workspace_role": self.repo.membership_role(workspace.id, user.id),
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

    def login(self, email: str, password: str, csrf_token: str) -> dict[str, Any]:
        user = self.repo.get_user_by_email(email)
        if user is None or not self.passwords.verify(user.password_hash, password):
            raise AuthenticationError("Invalid email or password.")
        if not user.is_verified:
            raise AuthenticationError("Email must be verified before login.")
        session = self.repo.create_session(user.id, csrf_token)
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
            return {"reset_token": ""}
        token = self.tokens.sign("password-reset", user.id)
        self._send_password_reset_email(user.email, token)
        self.repo.audit(None, user.id, "auth.password_reset_requested", {})
        self.repo.commit()
        return {"reset_token": token if self.expose_tokens else ""}

    def confirm_password_reset(self, token: str, password: str) -> None:
        self._validate_password(password)
        try:
            user_id = self.tokens.verify("password-reset", token, 60 * 30)
        except ValueError as exc:
            raise AuthenticationError("Invalid password reset token.") from exc
        if not self.repo.get_user(user_id):
            raise NotFoundError("User not found.")
        self.repo.update_password(user_id, self.passwords.hash(password))
        self.repo.audit(None, user_id, "auth.password_reset_confirmed", {})
        self.repo.commit()

    @staticmethod
    def _validate_password(password: str) -> None:
        if len(password) < 12:
            raise ValidationFailure("Password must be at least 12 characters.")

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
