from __future__ import annotations

import re

SECRET_PATTERNS = (
    re.compile(
        r"(?i)(api[_-]?key|secret|password|token|access[_-]?key[_-]?id|secret[_-]?access[_-]?key|bearer)"
        r"\s*[:=]\s*['\"]?([A-Za-z0-9_/\-+=.]{12,})"
    ),
    re.compile(r"sk-[A-Za-z0-9_\-]{12,}"),
    re.compile(r"AKIA[0-9A-Z]{12,20}"),
    re.compile(r"github_pat_[A-Za-z0-9_]{22,}"),
    re.compile(r"gh[pousr]_[A-Za-z0-9_]{20,}"),
    re.compile(r"AIza[0-9A-Za-z_\-]{20,}"),
    re.compile(r"(?i)\bbearer\s+([A-Za-z0-9_/\-+=.]{12,})"),
)


def redact_secret_like(text: str) -> tuple[str, list[str]]:
    warnings: list[str] = []
    redacted = text
    for pattern in SECRET_PATTERNS:
        next_text = pattern.sub(_replacement, redacted)
        if next_text != redacted:
            warnings.append("Secret-like value was redacted before indexing or external processing.")
        redacted = next_text
    return redacted, list(dict.fromkeys(warnings))


def _replacement(match: re.Match[str]) -> str:
    if len(match.groups()) >= 2:
        return f"{match.group(1)}=[REDACTED]"
    return "[REDACTED_SECRET]"
