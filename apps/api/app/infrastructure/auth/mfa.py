from __future__ import annotations

import base64
import hmac
import secrets
import struct
import time
from hashlib import sha1
from urllib.parse import quote


def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def provisioning_uri(secret: str, email: str, issuer: str) -> str:
    label = quote(f"{issuer}:{email}")
    return f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}&algorithm=SHA1&digits=6&period=30"


def verify_totp(secret: str, code: str, now: int | None = None, window: int = 1) -> bool:
    normalised = "".join(character for character in code if character.isdigit())
    if len(normalised) != 6:
        return False
    timestamp = int(time.time()) if now is None else now
    counter = timestamp // 30
    return any(
        hmac.compare_digest(_totp(secret, counter + offset), normalised)
        for offset in range(-window, window + 1)
    )


def current_totp(secret: str, now: int | None = None) -> str:
    timestamp = int(time.time()) if now is None else now
    return _totp(secret, timestamp // 30)


def generate_recovery_codes(count: int = 8) -> list[str]:
    return [f"{secrets.token_hex(4)}-{secrets.token_hex(4)}" for _ in range(count)]


def _totp(secret: str, counter: int) -> str:
    padding = "=" * ((8 - len(secret) % 8) % 8)
    key = base64.b32decode(f"{secret}{padding}", casefold=True)
    digest = hmac.new(key, struct.pack(">Q", counter), sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return f"{value % 1_000_000:06d}"
