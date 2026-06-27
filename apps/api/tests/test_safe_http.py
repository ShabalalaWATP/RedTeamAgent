from __future__ import annotations

import ssl
from urllib.parse import urlparse

import pytest

from app.infrastructure.ingestion import safe_http


def test_pinned_https_fetch_uses_validated_address(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, object]] = []

    class FakeRawSocket:
        def close(self) -> None:
            calls.append(("raw-close", None))

    class FakeContext:
        def wrap_socket(self, raw_socket: FakeRawSocket, server_hostname: str) -> object:
            calls.append(("wrap", (raw_socket, server_hostname)))
            return object()

    class FakeResponse:
        status = 200

        def getheaders(self) -> list[tuple[str, str]]:
            return [("Content-Type", "text/plain")]

        def read(self, size: int) -> bytes:
            calls.append(("read-size", size))
            return b"evidence"

    class FakeConnection:
        def __init__(self, host: str, port: int, timeout: int) -> None:
            calls.append(("connect-object", (host, port, timeout)))
            self.sock: object | None = None

        def request(self, method: str, target: str, headers: dict[str, str]) -> None:
            calls.append(("request", (method, target, headers, self.sock is not None)))

        def getresponse(self) -> FakeResponse:
            return FakeResponse()

        def close(self) -> None:
            calls.append(("connection-close", None))

    def fake_create_connection(address: tuple[str, int], timeout: int) -> FakeRawSocket:
        calls.append(("socket", (address, timeout)))
        return FakeRawSocket()

    monkeypatch.setattr(safe_http.socket, "create_connection", fake_create_connection)
    monkeypatch.setattr(safe_http.ssl, "create_default_context", lambda: FakeContext())
    monkeypatch.setattr(safe_http.http.client, "HTTPSConnection", FakeConnection)

    response = safe_http.fetch_https_with_pinned_ip(
        urlparse("https://example.com:444/path?q=1"),
        ["93.184.216.34"],
        timeout=7,
        max_bytes=12,
        user_agent="UnitTest",
    )

    assert response.status == 200
    assert response.headers == {"content-type": "text/plain"}
    assert response.body == b"evidence"
    assert ("socket", (("93.184.216.34", 444), 7)) in calls
    assert any(name == "wrap" and value[1] == "example.com" for name, value in calls)
    assert (
        "request",
        (
            "GET",
            "/path?q=1",
            {
                "Host": "example.com:444",
                "User-Agent": "UnitTest",
                "Connection": "close",
            },
            True,
        ),
    ) in calls
    assert ("read-size", 13) in calls
    assert ("connection-close", None) in calls


def test_pinned_https_fetch_rejects_invalid_inputs() -> None:
    with pytest.raises(safe_http.PinnedHttpsError):
        safe_http.fetch_https_with_pinned_ip(urlparse("http://example.com/"), ["93.184.216.34"], 1, 10, "ua")
    with pytest.raises(safe_http.PinnedHttpsError):
        safe_http.fetch_https_with_pinned_ip(urlparse("https://example.com/"), [], 1, 10, "ua")


def test_pinned_https_fetch_closes_raw_socket_when_tls_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    closed = False

    class FakeRawSocket:
        def close(self) -> None:
            nonlocal closed
            closed = True

    class FakeContext:
        def wrap_socket(self, raw_socket: FakeRawSocket, server_hostname: str) -> object:
            del raw_socket, server_hostname
            raise ssl.SSLError("certificate failure")

    monkeypatch.setattr(safe_http.socket, "create_connection", lambda *args, **kwargs: FakeRawSocket())
    monkeypatch.setattr(safe_http.ssl, "create_default_context", lambda: FakeContext())

    with pytest.raises(safe_http.PinnedHttpsError):
        safe_http.fetch_https_with_pinned_ip(urlparse("https://example.com/"), ["93.184.216.34"], 1, 10, "ua")

    assert closed


def test_pinned_https_fetch_tries_next_validated_address(monkeypatch: pytest.MonkeyPatch) -> None:
    attempted: list[str] = []

    def fake_fetch_from_address(parsed, address, timeout, max_bytes, user_agent):
        del parsed, timeout, max_bytes, user_agent
        attempted.append(address)
        if address == "93.184.216.34":
            raise OSError("temporary network failure")
        return safe_http.PinnedHttpsResponse(204, {}, b"")

    monkeypatch.setattr(safe_http, "_fetch_from_address", fake_fetch_from_address)

    response = safe_http.fetch_https_with_pinned_ip(
        urlparse("https://example.com/"),
        ["93.184.216.34", "93.184.216.35"],
        1,
        10,
        "ua",
    )

    assert response.status == 204
    assert attempted == ["93.184.216.34", "93.184.216.35"]
