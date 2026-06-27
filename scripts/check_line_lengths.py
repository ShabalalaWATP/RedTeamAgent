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
EXCLUDED_SUFFIXES = {
    ".md",
    ".json",
    ".lock",
    ".svg",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".pyc",
    ".coverage",
    ".db",
    ".sqlite",
    ".sqlite3",
}
EXCLUDED_NAMES = {".coverage", "openapi.ts"}
WARNING_LIMIT = 350
LIMIT = 400


def is_excluded(path: Path) -> bool:
    parts = set(path.relative_to(ROOT).parts)
    return bool(parts & EXCLUDED_DIRS) or path.suffix in EXCLUDED_SUFFIXES or path.name in EXCLUDED_NAMES


def main() -> int:
    warnings: list[str] = []
    failures: list[str] = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or is_excluded(path):
            continue
        line_count = len(path.read_text(encoding="utf-8", errors="ignore").splitlines())
        if line_count > LIMIT:
            failures.append(f"{path.relative_to(ROOT)} has {line_count} lines, limit is {LIMIT}")
        elif line_count > WARNING_LIMIT:
            warnings.append(
                f"{path.relative_to(ROOT)} has {line_count} lines, target is {WARNING_LIMIT}"
            )
    if failures:
        print("Line-count check failed:")
        print("\n".join(failures))
        return 1
    if warnings:
        print("Line-count warnings:")
        print("\n".join(warnings))
    print(
        "Line-count check passed: "
        f"no hand-written source file exceeds {LIMIT} lines "
        f"({WARNING_LIMIT} line target warns)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
