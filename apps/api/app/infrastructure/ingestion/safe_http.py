from __future__ import annotations

import http.client
import socket
import ssl
from dataclasses import dataclass
from urllib.parse import ParseResult


class PinnedHttpsError(Exception):
    """Raised when a pinned HTTPS request cannot be completed."""


@dataclass(frozen=True)
class PinnedHttpsResponse:
    status: int
    headers: dict[str, str]
    body: bytes


def fetch_https_with_pinned_ip(
    parsed: ParseResult,
    addresses: list[str],
    timeout: int,
    max_bytes: int,
    user_agent: str,
) -> PinnedHttpsResponse:
    if parsed.scheme != "https" or not parsed.hostname:
        raise PinnedHttpsError("Pinned HTTPS fetch requires an HTTPS URL with a host.")
    if not addresses:
        raise PinnedHttpsError("Pinned HTTPS fetch requires at least one validated address.")

    last_error: Exception | None = None
    for address in addresses:
        try:
            return _fetch_from_address(parsed, address, timeout, max_bytes, user_agent)
        except (OSError, ssl.SSLError, http.client.HTTPException) as exc:
            last_error = exc
    raise PinnedHttpsError("Pinned HTTPS fetch failed.") from last_error


def _fetch_from_address(
    parsed: ParseResult,
    address: str,
    timeout: int,
    max_bytes: int,
    user_agent: str,
) -> PinnedHttpsResponse:
    hostname = parsed.hostname or ""
    port = parsed.port or 443
    target = parsed.path or "/"
    if parsed.query:
        target = f"{target}?{parsed.query}"
    host_header = hostname if port == 443 else f"{hostname}:{port}"

    raw_socket = socket.create_connection((address, port), timeout=timeout)
    try:
        context = ssl.create_default_context()
        tls_socket = context.wrap_socket(raw_socket, server_hostname=hostname)
    except Exception:
        raw_socket.close()
        raise

    connection = http.client.HTTPSConnection(hostname, port=port, timeout=timeout)
    connection.sock = tls_socket
    try:
        connection.request(
            "GET",
            target,
            headers={
                "Host": host_header,
                "User-Agent": user_agent,
                "Connection": "close",
            },
        )
        response = connection.getresponse()
        return PinnedHttpsResponse(
            status=response.status,
            headers={key.lower(): value for key, value in response.getheaders()},
            body=response.read(max_bytes + 1),
        )
    finally:
        connection.close()
