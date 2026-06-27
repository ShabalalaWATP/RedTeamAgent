from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = [
    re.compile(r"sk-[A-Za-z0-9]{20,}"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"(?i)(api[_-]?key|secret|password)\s*=\s*['\"][^'\"]{12,}['\"]"),
]
SKIP_PARTS = {
    ".git",
    ".local-object-storage",
    ".venv",
    "__pycache__",
    "node_modules",
    "coverage",
    "htmlcov",
    "dist",
}
SKIP_FILES = {".env.example", "secret_scan.py"}


def should_scan(path: Path) -> bool:
    rel = path.relative_to(ROOT)
    return path.is_file() and not (set(rel.parts) & SKIP_PARTS) and path.name not in SKIP_FILES


def main() -> int:
    findings: list[str] = []
    for path in ROOT.rglob("*"):
        if not should_scan(path):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for index, line in enumerate(text.splitlines(), start=1):
            if "nosec" in line or "noqa: S10" in line:
                continue
            if any(pattern.search(line) for pattern in PATTERNS):
                findings.append(f"{path.relative_to(ROOT)}:{index}")
    if findings:
        print("Potential secret patterns found:")
        print("\n".join(findings))
        return 1
    print("Secret scan passed: no configured secret patterns found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
