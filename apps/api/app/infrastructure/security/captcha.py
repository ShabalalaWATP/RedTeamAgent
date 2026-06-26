from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.core.config import Settings
from app.domain.exceptions import ValidationFailure

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


@dataclass(frozen=True)
class CaptchaChallenge:
    required: bool
    provider: str
    token: str = ""
    prompt: str = ""
    expires_in_seconds: int = 0


class CaptchaVerifier:
    def __init__(self, settings: Settings) -> None:
        self.required = settings.captcha_required
        self.provider = settings.captcha_provider
        self.secret_key = settings.turnstile_secret_key
        self.challenge_ttl = settings.captcha_challenge_ttl_seconds
        self.signing_key = settings.app_secret_key.encode("utf-8")

    def issue_challenge(self, remote_ip: str | None = None) -> CaptchaChallenge:
        provider = self._active_provider()
        if not self.required:
            return CaptchaChallenge(required=False, provider="disabled")
        if provider != "challenge":
            return CaptchaChallenge(required=True, provider=provider)

        left = secrets.randbelow(9) + 1
        right = secrets.randbelow(9) + 1
        nonce = secrets.token_urlsafe(16)
        answer = str(left + right)
        prompt = f"What is {left} + {right}?"
        payload = {
            "n": nonce,
            "p": prompt,
            "a": self._digest(f"answer:{nonce}:{answer}"),
            "r": self._digest(f"remote:{nonce}:{remote_ip or ''}"),
            "e": int(time.time()) + self.challenge_ttl,
        }
        body = _b64(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        return CaptchaChallenge(
            required=True,
            provider="challenge",
            token=f"{body}.{self._digest(body)}",
            prompt=prompt,
            expires_in_seconds=self.challenge_ttl,
        )

    def verify(self, token: str | None, remote_ip: str | None = None) -> None:
        if not self.required:
            return
        if not token:
            raise ValidationFailure("Complete the security check and try again.")
        if self._active_provider() == "challenge":
            self._verify_challenge(token, remote_ip)
            return
        self._verify_turnstile(token, remote_ip)

    def _active_provider(self) -> str:
        if self.provider != "auto":
            return self.provider
        return "turnstile" if self.secret_key else "challenge"

    def _verify_challenge(self, token: str, remote_ip: str | None) -> None:
        try:
            prefix, challenge_token, answer = token.split(":", 2)
            body, signature = challenge_token.split(".", 1)
        except ValueError as exc:
            raise ValidationFailure("Security check failed. Try again.") from exc
        if prefix != "challenge" or not hmac.compare_digest(self._digest(body), signature):
            raise ValidationFailure("Security check failed. Try again.")

        try:
            payload = json.loads(_unb64(body).decode("utf-8"))
        except (ValueError, json.JSONDecodeError) as exc:
            raise ValidationFailure("Security check failed. Try again.") from exc

        nonce = str(payload.get("n", ""))
        expected_answer = str(payload.get("a", ""))
        expected_remote = str(payload.get("r", ""))
        expires_at = int(payload.get("e", 0))
        clean_answer = answer.strip()
        if expires_at < int(time.time()) or not clean_answer:
            raise ValidationFailure("Security check failed. Try again.")
        if not hmac.compare_digest(expected_remote, self._digest(f"remote:{nonce}:{remote_ip or ''}")):
            raise ValidationFailure("Security check failed. Try again.")
        if not hmac.compare_digest(expected_answer, self._digest(f"answer:{nonce}:{clean_answer}")):
            raise ValidationFailure("Security check failed. Try again.")

    def _verify_turnstile(self, token: str, remote_ip: str | None) -> None:
        if not self.secret_key:
            raise ValidationFailure("Security check is not configured.")
        fields = {"secret": self.secret_key, "response": token}
        if remote_ip:
            fields["remoteip"] = remote_ip
        request = Request(  # noqa: S310 - fixed Cloudflare verification URL.
            TURNSTILE_VERIFY_URL,
            data=urlencode(fields).encode("utf-8"),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=5) as response:  # noqa: S310 - fixed Cloudflare verification URL.
                payload = json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            raise ValidationFailure("Security check failed. Try again.") from exc
        if not payload.get("success"):
            raise ValidationFailure("Security check failed. Try again.")

    def _digest(self, value: str) -> str:
        return hmac.new(self.signing_key, value.encode("utf-8"), hashlib.sha256).hexdigest()


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _unb64(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")
