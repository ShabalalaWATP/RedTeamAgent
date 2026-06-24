from __future__ import annotations

import tarfile
from collections import Counter
from io import BytesIO
from pathlib import PurePosixPath
from typing import Literal
from zipfile import ZipFile

from app.domain.exceptions import ValidationFailure
from app.infrastructure.ingestion.redaction import redact_secret_like
from app.infrastructure.ingestion.types import ExtractedChunk, ExtractionResult

MAX_FILES = 200
MAX_EXPANDED_BYTES = 2_000_000
TEXT_SUFFIXES = {".py", ".ts", ".tsx", ".js", ".jsx", ".md", ".txt", ".json", ".toml", ".yml", ".yaml", ".cfg", ".ini"}
DEPENDENCY_FILES = {"package.json", "requirements.txt", "pyproject.toml", "poetry.lock", "uv.lock"}
CONFIG_FILES = {"Dockerfile", "docker-compose.yml", "wrangler.toml", "netlify.toml", ".env.example"}


def archive_result(filename: str, content_type: str, content: bytes) -> ExtractionResult:
    entries = (
        _tar_entries(content)
        if content_type in {"application/x-tar", "application/gzip"}
        else _zip_entries(content)
    )
    return entries_result(filename, entries, "code_archive")


def entries_result(filename: str, entries: list[tuple[str, bytes]], kind: str) -> ExtractionResult:
    chunks: list[ExtractedChunk] = []
    languages: Counter[str] = Counter()
    dependencies: list[str] = []
    configs: list[str] = []
    warnings = [f"{kind.replace('_', ' ').title()} is indexed as text and manifests only; code is never executed."]
    total = 0
    for path, data in entries:
        _validate_path(path)
        total += len(data)
        if total > MAX_EXPANDED_BYTES:
            raise ValidationFailure("Archive expands beyond the configured safety limit.")
        suffix = PurePosixPath(path).suffix.lower()
        languages[_language(suffix)] += 1
        if PurePosixPath(path).name in DEPENDENCY_FILES:
            dependencies.append(path)
        if PurePosixPath(path).name in CONFIG_FILES:
            configs.append(path)
        if suffix in TEXT_SUFFIXES:
            text, redaction_warnings = redact_secret_like(data.decode("utf-8", errors="replace"))
            warnings.extend(redaction_warnings)
            chunks.extend(_line_chunks(filename, path, text))
    if not chunks:
        chunks.append(ExtractedChunk(locator=f"{filename}:manifest", text="Archive contained no supported text files."))
    return ExtractionResult(
        chunks,
        {
            "kind": kind,
            "files": len(entries),
            "language_summary": dict(languages),
            "dependency_index": dependencies,
            "config_index": configs,
            "code_execution": "disabled",
        },
        list(dict.fromkeys(warnings)),
    )


def _zip_entries(content: bytes) -> list[tuple[str, bytes]]:
    with ZipFile(BytesIO(content)) as archive:
        if len(archive.infolist()) > MAX_FILES:
            raise ValidationFailure("Archive contains too many files.")
        entries = []
        for info in archive.infolist():
            if info.is_dir():
                continue
            if (info.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValidationFailure("Archive symlinks are not allowed.")
            entries.append((info.filename, archive.read(info)))
        return entries


def _tar_entries(content: bytes) -> list[tuple[str, bytes]]:
    mode: Literal["r:gz", "r:"] = "r:gz" if content[:2] == b"\x1f\x8b" else "r:"
    with tarfile.open(fileobj=BytesIO(content), mode=mode) as archive:
        members = [member for member in archive.getmembers() if member.isfile()]
        if len(members) > MAX_FILES:
            raise ValidationFailure("Archive contains too many files.")
        entries = []
        for member in members:
            if member.issym() or member.islnk():
                raise ValidationFailure("Archive links are not allowed.")
            extracted = archive.extractfile(member)
            entries.append((member.name, extracted.read() if extracted else b""))
        return entries


def _validate_path(path: str) -> None:
    pure = PurePosixPath(path.replace("\\", "/"))
    if pure.is_absolute() or ".." in pure.parts or len(pure.parts) > 20:
        raise ValidationFailure("Archive path is not safe.")
    if pure.suffix.lower() in {".zip", ".tar", ".gz", ".tgz"}:
        raise ValidationFailure("Nested archives are not allowed.")


def _line_chunks(filename: str, path: str, text: str) -> list[ExtractedChunk]:
    lines = text.splitlines()
    chunk_text = "\n".join(lines[:80])
    return [ExtractedChunk(locator=f"{filename}:{path}:1-{min(len(lines), 80)}", text=chunk_text or path)]


def _language(suffix: str) -> str:
    return {
        ".py": "Python",
        ".ts": "TypeScript",
        ".tsx": "TypeScript React",
        ".js": "JavaScript",
        ".jsx": "JavaScript React",
        ".md": "Markdown",
        ".json": "JSON",
    }.get(suffix, "Other")
