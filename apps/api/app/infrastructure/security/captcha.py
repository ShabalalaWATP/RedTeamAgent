from __future__ import annotations

import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.core.config import Settings
from app.domain.exceptions import ValidationFailure

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


class TurnstileVerifier:
    def __init__(self, settings: Settings) -> None:
        self.required = settings.captcha_required
        self.secret_key = settings.turnstile_secret_key

    def verify(self, token: str | None, remote_ip: str | None = None) -> None:
        if not self.required:
            return
        if not token:
            raise ValidationFailure("Complete the security check and try again.")
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
