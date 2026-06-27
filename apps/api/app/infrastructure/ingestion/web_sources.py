from __future__ import annotations

import ipaddress
import os
import socket
import subprocess  # nosec
import tempfile
from dataclasses import dataclass
from datetime import UTC, datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

from app.domain.exceptions import ValidationFailure
from app.domain.policies import BLOCKED_METADATA_HOSTS
from app.infrastructure.ingestion.code_archives import MAX_FILES, TEXT_SUFFIXES, entries_result
from app.infrastructure.ingestion.redaction import redact_secret_like
from app.infrastructure.ingestion.safe_http import PinnedHttpsError, fetch_https_with_pinned_ip
from app.infrastructure.ingestion.types import ExtractedChunk, ExtractionResult

MAX_WEBSITE_BYTES = 1_000_000
MAX_REDIRECTS = 5
MAX_FETCH_TIMEOUT_SECONDS = 10
MAX_REPOSITORY_BYTES = 2_000_000
ALLOWED_REPOSITORY_HOSTS = {
    "github.com",
    "gitlab.com",
    "bitbucket.org",
    "dev.azure.com",
    "ssh.dev.azure.com",
}


@dataclass(frozen=True)
class WebsiteSnapshot:
    final_url: str
    content: bytes
    content_type: str
    extraction: ExtractionResult


@dataclass(frozen=True)
class FetchResponse:
    url: str
    status: int
    headers: dict[str, str]
    body: bytes


def website_snapshot(url: str, allow_domains: list[str], block_domains: list[str]) -> WebsiteSnapshot:
    fetched = _fetch_public_url(url, allow_domains, block_domains)
    accessed = datetime.now(UTC).isoformat()
    parsed = urlparse(fetched.url)
    title = parsed.hostname or "website"
    text, warnings = redact_secret_like(_extract_visible_text(fetched.body, fetched.headers.get("content-type", "")))
    excerpt = text or f"Website snapshot for {fetched.url}. No visible text was extracted."
    extraction = ExtractionResult(
        [ExtractedChunk(locator=f"{title}:snapshot", text=excerpt)],
        {
            "kind": "website",
            "url": url,
            "final_url": fetched.url,
            "accessed_at": accessed,
            "redirect_chain": fetched.headers.get("x-redteamagent-redirect-chain", url).split(" "),
            "snapshot_stored": True,
            "bytes": len(fetched.body),
        },
        ["Website fetch policy validated scheme, DNS, redirects, timeout and size before snapshotting.", *warnings],
    )
    return WebsiteSnapshot(fetched.url, fetched.body, fetched.headers.get("content-type", "text/html"), extraction)


def repository_snapshot(url: str) -> WebsiteSnapshot:
    parsed, _ = _validate_public_url(url, [], [])
    _validate_repository_host(parsed.hostname or "")
    entries = _clone_repository_entries(url)
    host = parsed.hostname or "repository"
    accessed = datetime.now(UTC).isoformat()
    extraction = entries_result(f"{host}.repo", entries, "public_git_repository")
    manifest = (
        f"Public Git repository manifest for {url}\n"
        f"Accessed: {accessed}\n"
        f"Files indexed: {extraction.metadata.get('files', 0)}\n"
        "Code is indexed as text only and is never executed.\n"
    )
    extraction = ExtractionResult(
        [*extraction.chunks, ExtractedChunk(locator=f"{host}:repository manifest", text=manifest)],
        {
            **extraction.metadata,
            "url": url,
            "accessed_at": accessed,
        },
        [*extraction.warnings, "Public repository ingestion used shallow Git metadata without checkout."],
    )
    return WebsiteSnapshot(url, manifest.encode("utf-8"), "text/plain", extraction)


def _fetch_public_url(url: str, allow_domains: list[str], block_domains: list[str]) -> FetchResponse:
    current = url
    chain: list[str] = []
    for _ in range(MAX_REDIRECTS + 1):
        parsed, pinned_addresses = _validate_public_url(current, allow_domains, block_domains)
        response = _fetch_once(current, pinned_addresses)
        final_response_url = response.url or current
        _validate_public_url(final_response_url, allow_domains, block_domains)
        chain.append(current)
        if response.status in {301, 302, 303, 307, 308}:
            location = response.headers.get("location")
            if not location:
                raise ValidationFailure("Website redirect is missing a location.")
            current = urljoin(current, location)
            continue
        if response.status >= 400:
            raise ValidationFailure("Website fetch returned an error status.")
        if len(response.body) > MAX_WEBSITE_BYTES:
            raise ValidationFailure("Website response exceeds the configured size limit.")
        headers = {**response.headers, "x-redteamagent-redirect-chain": " ".join(chain)}
        return FetchResponse(final_response_url, response.status, headers, response.body)
    raise ValidationFailure("Website redirect limit exceeded.")


def _fetch_once(url: str, pinned_addresses: list[str]) -> FetchResponse:
    parsed = urlparse(url)
    try:
        response = fetch_https_with_pinned_ip(
            parsed,
            pinned_addresses,
            MAX_FETCH_TIMEOUT_SECONDS,
            MAX_WEBSITE_BYTES,
            "RedTeamAgent/Stage2",
        )
        return FetchResponse(
            url=url,
            status=response.status,
            headers=response.headers,
            body=response.body,
        )
    except PinnedHttpsError as exc:
        raise ValidationFailure("Website fetch failed.") from exc


def _clone_repository_entries(url: str) -> list[tuple[str, bytes]]:
    with tempfile.TemporaryDirectory(prefix="redteamagent-git-") as temp_dir:
        target = Path(temp_dir) / "repo"
        env = _git_env(temp_dir)
        clone_command = [
            "git",
            "-c",
            "protocol.file.allow=never",
            "-c",
            "protocol.ext.allow=never",
            "-c",
            "http.followRedirects=false",
            "clone",
            "--depth",
            "1",
            "--filter=blob:none",
            "--no-checkout",
            "--no-tags",
            "--single-branch",
            url,
            str(target),
        ]
        _run_git(clone_command, env, temp_dir, 45)
        names = _run_git(["git", "-C", str(target), "ls-tree", "-r", "--name-only", "HEAD"], env, temp_dir, 20)
        paths = [name for name in names.stdout.splitlines() if name.strip()]
        if len(paths) > MAX_FILES:
            raise ValidationFailure("Repository contains too many files for Stage 2 ingestion.")
        entries: list[tuple[str, bytes]] = []
        total = 0
        for path in paths:
            if not _should_fetch_repository_blob(path):
                entries.append((path, b""))
                continue
            blob = _run_git(["git", "-C", str(target), "show", f"HEAD:{path}"], env, temp_dir, 20).stdout.encode()
            total += len(blob)
            if total > MAX_REPOSITORY_BYTES:
                raise ValidationFailure("Repository text exceeds the configured extraction limit.")
            entries.append((path, blob))
        return entries


def _run_git(command: list[str], env: dict[str, str], cwd: str, timeout: int) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(  # noqa: S603  # nosec
            command,
            cwd=cwd,
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        raise ValidationFailure("Public Git repository could not be ingested safely.") from exc


def _git_env(home: str) -> dict[str, str]:
    keys = ["PATH", "SYSTEMROOT", "WINDIR", "COMSPEC"]
    env = {key: value for key, value in os.environ.items() if key in keys}
    env.update(
        {
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_TERMINAL_PROMPT": "0",
            "HOME": home,
            "USERPROFILE": home,
        }
    )
    return env


def _should_fetch_repository_blob(path: str) -> bool:
    name = Path(path).name
    suffix = Path(path).suffix.lower()
    return suffix in TEXT_SUFFIXES or name in {"package.json", "requirements.txt", "pyproject.toml", "Dockerfile"}


def _validate_public_url(url: str, allow_domains: list[str], block_domains: list[str]):
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValidationFailure("Only HTTPS URLs can be ingested.")
    if not parsed.hostname:
        raise ValidationFailure("URL host is required.")
    if parsed.username or parsed.password:
        raise ValidationFailure("URL credentials are not allowed.")
    hostname = parsed.hostname.lower()
    if hostname in BLOCKED_METADATA_HOSTS or hostname in {item.lower() for item in block_domains}:
        raise ValidationFailure("URL host is blocked by policy.")
    if allow_domains and hostname not in {item.lower() for item in allow_domains}:
        raise ValidationFailure("URL host is not in the review allow-list.")
    addresses = _resolve_host(hostname)
    for address in addresses:
        ip = ipaddress.ip_address(address)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_unspecified:
            raise ValidationFailure("URL resolves to a private or local network address.")
    return parsed, addresses


def _resolve_host(hostname: str) -> list[str]:
    try:
        return [str(info[4][0]) for info in socket.getaddrinfo(hostname, 443)]
    except socket.gaierror as exc:
        raise ValidationFailure("URL host cannot be resolved.") from exc


def _validate_repository_host(hostname: str) -> None:
    if hostname.lower() not in ALLOWED_REPOSITORY_HOSTS:
        raise ValidationFailure("Repository host is not in the ingestion allow-list.")


def _extract_visible_text(content: bytes, content_type: str) -> str:
    text = content.decode("utf-8", errors="replace")
    if "html" not in content_type.lower():
        return " ".join(text.split())
    parser = _VisibleTextParser()
    parser.feed(text)
    return parser.text()


class _VisibleTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._hidden = False
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        if tag in {"script", "style", "noscript"}:
            self._hidden = True

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript"}:
            self._hidden = False

    def handle_data(self, data: str) -> None:
        if not self._hidden and data.strip():
            self._parts.append(data.strip())

    def text(self) -> str:
        return " ".join(" ".join(self._parts).split())
