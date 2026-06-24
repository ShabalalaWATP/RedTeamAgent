from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_DIRS = {
    ".git",
    ".venv",
    "node_modules",
    "dist",
    "coverage",
    "htmlcov",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".local-object-storage",
    "output",
}
EXCLUDED_SUFFIXES = {".md", ".json", ".lock", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".pyc", ".coverage"}
EXCLUDED_NAMES = {".coverage", "openapi.ts"}
LIMIT = 400


def is_excluded(path: Path) -> bool:
    parts = set(path.relative_to(ROOT).parts)
    return bool(parts & EXCLUDED_DIRS) or path.suffix in EXCLUDED_SUFFIXES or path.name in EXCLUDED_NAMES


def main() -> int:
    failures: list[str] = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or is_excluded(path):
            continue
        line_count = len(path.read_text(encoding="utf-8", errors="ignore").splitlines())
        if line_count > LIMIT:
            failures.append(f"{path.relative_to(ROOT)} has {line_count} lines, limit is {LIMIT}")
    if failures:
        print("Line-count check failed:")
        print("\n".join(failures))
        return 1
    print(f"Line-count check passed: no hand-written source file exceeds {LIMIT} lines.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
