from __future__ import annotations

import subprocess

import pytest

from app.domain.exceptions import ValidationFailure
from app.infrastructure.ingestion import web_sources


def test_stage2_website_ssrf_redirect_and_rebinding_guards(monkeypatch: pytest.MonkeyPatch) -> None:
    def public_fetch(url: str) -> web_sources.FetchResponse:
        return web_sources.FetchResponse(url, 200, {"content-type": "text/html"}, b"<p>Evidence</p>")

    monkeypatch.setattr(web_sources, "_fetch_once", public_fetch)
    for address in ["127.0.0.1", "10.0.0.1", "169.254.1.1", "::1", "fd00::1"]:
        monkeypatch.setattr(web_sources, "_resolve_host", lambda hostname, value=address: [value])
        with pytest.raises(ValidationFailure):
            web_sources.website_snapshot("https://example.com/research", [], [])

    with pytest.raises(ValidationFailure):
        web_sources.website_snapshot("https://169.254.169.254/latest", [], [])
    with pytest.raises(ValidationFailure):
        web_sources.website_snapshot("http://example.com/insecure", [], [])

    monkeypatch.setattr(web_sources, "_resolve_host", lambda hostname: ["93.184.216.34"])
    monkeypatch.setattr(
        web_sources,
        "_fetch_once",
        lambda url: web_sources.FetchResponse(url, 302, {"location": "https://127.0.0.1/internal"}, b""),
    )
    with pytest.raises(ValidationFailure):
        web_sources.website_snapshot("https://example.com/redirect", [], [])

    addresses = iter([["93.184.216.34"], ["10.0.0.2"]])
    monkeypatch.setattr(web_sources, "_resolve_host", lambda hostname: next(addresses))
    monkeypatch.setattr(web_sources, "_fetch_once", public_fetch)
    with pytest.raises(ValidationFailure):
        web_sources.website_snapshot("https://example.com/rebinding", [], [])

    monkeypatch.setattr(web_sources, "_resolve_host", lambda hostname: ["93.184.216.34"])
    monkeypatch.setattr(
        web_sources,
        "_fetch_once",
        lambda url: web_sources.FetchResponse(url, 200, {"content-type": "text/plain"}, b"x" * 1_000_001),
    )
    with pytest.raises(ValidationFailure):
        web_sources.website_snapshot("https://example.com/too-large", [], [])


def test_stage2_website_fetch_redirect_success_and_low_level_fetch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(web_sources, "_resolve_host", lambda hostname: ["93.184.216.34"])

    def redirect_then_success(url: str) -> web_sources.FetchResponse:
        if url.endswith("/start"):
            return web_sources.FetchResponse(url, 302, {"location": "/final"}, b"")
        return web_sources.FetchResponse(
            url,
            200,
            {"content-type": "text/html"},
            b"<html><script>ignore()</script><p>Visible evidence</p></html>",
        )

    monkeypatch.setattr(web_sources, "_fetch_once", redirect_then_success)
    snapshot = web_sources.website_snapshot("https://example.com/start", ["example.com"], [])
    assert snapshot.final_url == "https://example.com/final"
    assert snapshot.extraction.metadata["redirect_chain"] == ["https://example.com/start", "https://example.com/final"]
    assert "Visible evidence" in snapshot.extraction.chunks[0].text
    assert "ignore" not in snapshot.extraction.chunks[0].text

    monkeypatch.undo()

    class FakeHeaders(dict[str, str]):
        def items(self):  # type: ignore[override]
            return [("Content-Type", "text/plain")]

    class FakeResponse:
        status = 200
        headers = FakeHeaders()

        def __enter__(self) -> FakeResponse:
            return self

        def __exit__(self, *args: object) -> None:
            del args

        def geturl(self) -> str:
            return "https://example.com/raw"

        def read(self, size: int) -> bytes:
            assert size == web_sources.MAX_WEBSITE_BYTES + 1
            return b"raw evidence"

    class FakeOpener:
        def open(self, request: object, timeout: int) -> FakeResponse:
            del request
            assert timeout == web_sources.MAX_FETCH_TIMEOUT_SECONDS
            return FakeResponse()

    monkeypatch.setattr(web_sources, "build_opener", lambda handler: FakeOpener())
    fetched = web_sources._fetch_once("https://example.com/raw")
    assert fetched.body == b"raw evidence"
    assert fetched.headers["content-type"] == "text/plain"


def test_stage2_website_fetch_error_branches(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(web_sources, "_resolve_host", lambda hostname: ["93.184.216.34"])
    monkeypatch.setattr(
        web_sources,
        "_fetch_once",
        lambda url: web_sources.FetchResponse(url, 302, {}, b""),
    )
    with pytest.raises(ValidationFailure):
        web_sources.website_snapshot("https://example.com/missing-location", [], [])

    monkeypatch.setattr(
        web_sources,
        "_fetch_once",
        lambda url: web_sources.FetchResponse(url, 500, {}, b""),
    )
    with pytest.raises(ValidationFailure):
        web_sources.website_snapshot("https://example.com/error", [], [])


def test_stage2_git_repository_helper_uses_no_checkout_and_caps(monkeypatch: pytest.MonkeyPatch) -> None:
    commands: list[list[str]] = []

    def fake_run_git(
        command: list[str],
        env: dict[str, str],
        cwd: str,
        timeout: int,
    ) -> subprocess.CompletedProcess[str]:
        del env, cwd, timeout
        commands.append(command)
        if "ls-tree" in command:
            return subprocess.CompletedProcess(command, 0, stdout="app.py\nimage.png\npackage.json\n")
        if command[-1] == "HEAD:app.py":
            return subprocess.CompletedProcess(command, 0, stdout="print('safe')\n")
        if command[-1] == "HEAD:package.json":
            return subprocess.CompletedProcess(command, 0, stdout='{"dependencies": {}}\n')
        return subprocess.CompletedProcess(command, 0, stdout="")

    monkeypatch.setattr(web_sources, "_run_git", fake_run_git)
    entries = web_sources._clone_repository_entries("https://github.com/example/repo.git")
    assert commands[0][0:3] == ["git", "-c", "protocol.file.allow=never"]
    assert "--no-checkout" in commands[0]
    assert ("image.png", b"") in entries
    assert ("app.py", b"print('safe')\n") in entries


def test_stage2_git_subprocess_wrapper_success_and_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_subprocess_run(*args: object, **kwargs: object) -> subprocess.CompletedProcess[str]:
        del args, kwargs
        return subprocess.CompletedProcess(["git"], 0, stdout="ok")

    monkeypatch.setattr(web_sources.subprocess, "run", fake_subprocess_run)
    assert web_sources._run_git(["git", "--version"], {}, ".", 1).stdout == "ok"

    def missing_git(*args: object, **kwargs: object) -> subprocess.CompletedProcess[str]:
        del args, kwargs
        raise FileNotFoundError

    monkeypatch.setattr(web_sources.subprocess, "run", missing_git)
    with pytest.raises(ValidationFailure):
        web_sources._run_git(["git"], {}, ".", 1)
