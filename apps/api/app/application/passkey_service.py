from __future__ import annotations

import json
from hashlib import sha256
from typing import Any
from urllib.parse import urlparse

from webauthn import (  # type: ignore[import-untyped]
    generate_authentication_options,
    generate_registration_options,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url, options_to_json  # type: ignore[import-untyped]
from webauthn.helpers.exceptions import WebAuthnException  # type: ignore[import-untyped]
from webauthn.helpers.structs import (  # type: ignore[import-untyped]
    AuthenticatorSelectionCriteria,
    AuthenticatorTransport,
    PublicKeyCredentialDescriptor,
    PublicKeyCredentialHint,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from app.domain.exceptions import AuthenticationError, ConflictError, NotFoundError, ValidationFailure

PRIVILEGED_ACCOUNT_TYPES = {"owner", "admin"}


class PasskeyService:
    def __init__(
        self,
        repo: Any,
        public_app_url: str,
        rp_id: str,
        rp_name: str,
        allowed_origins: str = "",
    ) -> None:
        self.repo = repo
        self.origins, self.rp_id = _origins_and_rp_id(public_app_url, rp_id, allowed_origins)
        self.rp_name = rp_name

    def requirements(self, user_id: str, session_id: str, account_type: str) -> dict[str, bool]:
        passkey_count = self.repo.count_user_passkeys(user_id)
        session = self.repo.get_session(session_id)
        required = account_type in PRIVILEGED_ACCOUNT_TYPES
        authenticator_enabled = _totp_enabled(self.repo, user_id)
        passkey_registered = passkey_count > 0
        passkey_verified = bool(session and session.passkey_verified_at)
        return {
            "required": required,
            "authenticator_app_enabled": authenticator_enabled,
            "passkey_registered": passkey_registered,
            "passkey_verified": passkey_verified,
            "setup_required": required and (not authenticator_enabled or not passkey_registered),
            "passkey_verification_required": required and passkey_registered and not passkey_verified,
        }

    def status(self, user_id: str, session_id: str, account_type: str) -> dict[str, Any]:
        passkeys = self.repo.list_user_passkeys(user_id)
        requirements = self.requirements(user_id, session_id, account_type)
        return {
            **requirements,
            "registered": bool(passkeys),
            "count": len(passkeys),
            "credentials": [
                {
                    "id": item.id,
                    "name": item.name,
                    "created_at": item.created_at,
                    "last_used_at": item.last_used_at,
                }
                for item in passkeys
            ],
        }

    def registration_options(self, user: Any, session_id: str) -> dict[str, Any]:
        existing_passkeys = self.repo.list_user_passkeys(user.id)
        session = self.repo.get_session(session_id)
        recovery_registration = bool(existing_passkeys) and not bool(session and session.passkey_verified_at)
        options = generate_registration_options(
            rp_id=self.rp_id,
            rp_name=self.rp_name,
            user_id=_registration_user_handle(user.id, session_id, recovery_registration),
            user_name=user.email,
            user_display_name=user.email,
            authenticator_selection=AuthenticatorSelectionCriteria(
                resident_key=ResidentKeyRequirement.PREFERRED,
                user_verification=UserVerificationRequirement.REQUIRED,
            ),
            hints=[PublicKeyCredentialHint.CLIENT_DEVICE],
            exclude_credentials=[
                _passkey_descriptor(item)
                for item in existing_passkeys
            ] if not recovery_registration else [],
        )
        self.repo.set_session_passkey_challenge(
            session_id,
            "registration",
            bytes_to_base64url(options.challenge),
        )
        self.repo.audit(None, user.id, "auth.passkey_registration_started", {})
        self.repo.commit()
        return json.loads(options_to_json(options))

    def verify_registration(
        self,
        user_id: str,
        session_id: str,
        credential: dict[str, Any],
        name: str | None,
    ) -> dict[str, Any]:
        challenge = self.repo.get_session_passkey_challenge(session_id, "registration")
        if not challenge:
            raise AuthenticationError("Passkey registration expired. Try again.")
        try:
            verification = verify_registration_response(
                credential=credential,
                expected_challenge=base64url_to_bytes(challenge),
                expected_rp_id=self.rp_id,
                expected_origin=self.origins,
                require_user_verification=True,
            )
        except WebAuthnException as exc:
            raise AuthenticationError("Passkey registration failed. Try again from this site and device.") from exc
        credential_id = bytes_to_base64url(verification.credential_id)
        if self.repo.get_passkey_by_credential_id(credential_id):
            raise ConflictError("This passkey is already registered.")
        passkey = self.repo.create_passkey(
            user_id,
            _clean_name(name),
            credential_id,
            bytes_to_base64url(verification.credential_public_key),
            verification.sign_count,
            _extract_transports(credential),
            str(verification.aaguid),
        )
        self.repo.set_session_passkey_challenge(session_id, "registration", None)
        self.repo.mark_session_passkey_verified(session_id)
        self.repo.audit(None, user_id, "auth.passkey_registered", {"passkey_id": passkey.id})
        self.repo.commit()
        return {"id": passkey.id, "name": passkey.name}

    def authentication_options(self, user_id: str, session_id: str) -> dict[str, Any]:
        passkeys = self.repo.list_user_passkeys(user_id)
        if not passkeys:
            raise ValidationFailure("Register a passkey before verifying one.")
        options = generate_authentication_options(
            rp_id=self.rp_id,
            allow_credentials=[
                _passkey_descriptor(item) for item in passkeys
            ],
            user_verification=UserVerificationRequirement.REQUIRED,
        )
        self.repo.set_session_passkey_challenge(
            session_id,
            "authentication",
            bytes_to_base64url(options.challenge),
        )
        self.repo.audit(None, user_id, "auth.passkey_authentication_started", {})
        self.repo.commit()
        response = json.loads(options_to_json(options))
        response["hints"] = [PublicKeyCredentialHint.CLIENT_DEVICE.value]
        return response

    def verify_authentication(self, user_id: str, session_id: str, credential: dict[str, Any]) -> None:
        challenge = self.repo.get_session_passkey_challenge(session_id, "authentication")
        if not challenge:
            self.repo.audit(None, user_id, "auth.passkey_verification_failed", {"reason": "missing_challenge"})
            self.repo.commit()
            raise AuthenticationError("Passkey verification expired. Try again.")
        passkey = self.repo.get_passkey_by_credential_id(_credential_id(credential))
        if passkey is None or passkey.user_id != user_id:
            self.repo.audit(None, user_id, "auth.passkey_verification_failed", {"reason": "credential_not_found"})
            self.repo.commit()
            raise AuthenticationError("Passkey verification failed.")
        try:
            verification = verify_authentication_response(
                credential=credential,
                expected_challenge=base64url_to_bytes(challenge),
                expected_rp_id=self.rp_id,
                expected_origin=self.origins,
                credential_public_key=base64url_to_bytes(passkey.public_key),
                credential_current_sign_count=passkey.sign_count,
                require_user_verification=True,
            )
        except WebAuthnException as exc:
            detail = str(exc)
            self.repo.audit(
                None,
                user_id,
                "auth.passkey_verification_failed",
                {"reason": type(exc).__name__, "detail": detail[:240], "passkey_id": passkey.id},
            )
            self.repo.commit()
            raise AuthenticationError(_authentication_error_message(detail)) from exc
        if bytes_to_base64url(verification.credential_id) != passkey.credential_id:
            self.repo.audit(None, user_id, "auth.passkey_verification_failed", {"reason": "credential_mismatch"})
            self.repo.commit()
            raise AuthenticationError("Passkey verification failed.")
        self.repo.update_passkey_usage(passkey.id, verification.new_sign_count)
        self.repo.mark_session_passkey_verified(session_id)
        self.repo.audit(None, user_id, "auth.passkey_verified", {"passkey_id": passkey.id})
        self.repo.commit()

    def delete_passkey(
        self,
        user_id: str,
        passkey_id: str,
        account_type: str,
        privileged_mfa_required: bool,
    ) -> None:
        passkey = self.repo.get_passkey(passkey_id)
        if passkey is None or passkey.user_id != user_id:
            raise NotFoundError("Passkey not found.")
        if privileged_mfa_required and account_type in PRIVILEGED_ACCOUNT_TYPES:
            if self.repo.count_user_passkeys(user_id) <= 1:
                raise ConflictError("Owner and admin accounts must keep at least one passkey.")
        self.repo.delete_passkey(passkey_id)
        self.repo.audit(None, user_id, "auth.passkey_deleted", {"passkey_id": passkey_id})
        self.repo.commit()


def _origins_and_rp_id(public_app_url: str, configured_rp_id: str, configured_origins: str) -> tuple[list[str], str]:
    public_origin, public_hostname = _origin_and_hostname(public_app_url, "PUBLIC_APP_URL")
    rp_id = configured_rp_id.strip() or public_hostname
    if not _hostname_matches_rp_id(public_hostname, rp_id):
        raise RuntimeError("PUBLIC_APP_URL must use the WebAuthn RP ID domain or a subdomain.")
    origins = [public_origin]
    for value in configured_origins.split(","):
        clean = value.strip()
        if not clean:
            continue
        origin, hostname = _origin_and_hostname(clean, "WEBAUTHN_ALLOWED_ORIGINS")
        if not _hostname_matches_rp_id(hostname, rp_id):
            raise RuntimeError("WEBAUTHN_ALLOWED_ORIGINS must use the WebAuthn RP ID domain or a subdomain.")
        if origin not in origins:
            origins.append(origin)
    return origins, rp_id


def _origin_and_hostname(url: str, label: str) -> tuple[str, str]:
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc or not parsed.hostname:
        raise RuntimeError(f"{label} must contain absolute URLs for passkey support.")
    return f"{parsed.scheme}://{parsed.netloc}", parsed.hostname


def _hostname_matches_rp_id(hostname: str, rp_id: str) -> bool:
    return hostname == rp_id or hostname.endswith(f".{rp_id}")


def _registration_user_handle(user_id: str, session_id: str, recovery_registration: bool) -> bytes:
    if recovery_registration:
        return sha256(f"{user_id}:passkey-recovery:{session_id}".encode()).digest()
    return user_id.encode()


def _passkey_descriptor(passkey: Any) -> PublicKeyCredentialDescriptor:
    return PublicKeyCredentialDescriptor(
        id=base64url_to_bytes(passkey.credential_id),
        transports=_authenticator_transports(getattr(passkey, "transports", None)),
    )


def _authenticator_transports(values: object) -> list[AuthenticatorTransport] | None:
    if not isinstance(values, list):
        return None
    transports: list[AuthenticatorTransport] = []
    for value in values:
        if not isinstance(value, str):
            continue
        try:
            transports.append(AuthenticatorTransport(value))
        except ValueError:
            continue
    if AuthenticatorTransport.INTERNAL in transports:
        return [AuthenticatorTransport.INTERNAL]
    return transports or None


def _authentication_error_message(detail: str) -> str:
    if "User verification is required" in detail and "not verified" in detail:
        return (
            "Passkey verification needs Windows Hello, device PIN, fingerprint, or face confirmation. "
            "Try again and approve the device verification prompt."
        )
    return "Passkey verification failed. Try again from this site and device."


def _totp_enabled(repo: Any, user_id: str) -> bool:
    setting = repo.get_mfa_setting(user_id)
    return bool(setting and setting.enabled)


def _clean_name(name: str | None) -> str:
    cleaned = (name or "").strip()
    return cleaned[:120] if cleaned else "Passkey"


def _extract_transports(credential: dict[str, Any]) -> list[str]:
    raw_response = credential.get("response")
    response = raw_response if isinstance(raw_response, dict) else {}
    raw_transports = response.get("transports") or credential.get("transports") or []
    if not isinstance(raw_transports, list):
        return []
    return [item[:40] for item in raw_transports if isinstance(item, str)]


def _credential_id(credential: dict[str, Any]) -> str:
    raw_id = credential.get("rawId") or credential.get("id")
    if not isinstance(raw_id, str) or not raw_id:
        raise ValidationFailure("Passkey response is missing a credential id.")
    return raw_id
