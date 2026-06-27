from __future__ import annotations

import ast
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1] / "app"
REPO_ROOT = APP_ROOT.parents[2]


def test_application_and_domain_do_not_import_framework_or_orm() -> None:
    forbidden = ("fastapi", "sqlalchemy", "celery", "boto3")
    checked = _python_files(APP_ROOT / "application") + _python_files(APP_ROOT / "domain")
    _assert_no_import_prefix(checked, forbidden)


def test_domain_does_not_import_application_interfaces_or_infrastructure() -> None:
    checked = _python_files(APP_ROOT / "domain")
    _assert_no_import_prefix(checked, ("app.application", "app.interfaces", "app.infrastructure"))


def test_application_does_not_import_interfaces_or_infrastructure() -> None:
    checked = _python_files(APP_ROOT / "application")
    _assert_no_import_prefix(checked, ("app.interfaces", "app.infrastructure"))


def test_no_provider_agent_or_source_extension_conditionals() -> None:
    text = "\n".join(path.read_text(encoding="utf-8") for path in APP_ROOT.rglob("*.py"))
    assert "if provider ==" not in text
    assert "if agent ==" not in text
    assert "if source_type ==" not in text


def test_line_length_gate_has_warning_and_hard_limit() -> None:
    script = (REPO_ROOT / "scripts" / "check_line_lengths.py").read_text(encoding="utf-8")
    assert "WARNING_LIMIT = 350" in script
    assert "LIMIT = 400" in script


def _python_files(root: Path) -> list[Path]:
    return list(root.rglob("*.py"))


def _assert_no_import_prefix(paths: list[Path], forbidden_prefixes: tuple[str, ...]) -> None:
    violations: list[str] = []
    for path in paths:
        for imported in _imports(path):
            if imported in forbidden_prefixes or imported.startswith(tuple(f"{item}." for item in forbidden_prefixes)):
                violations.append(f"{path.relative_to(APP_ROOT)} imports {imported}")
    assert not violations, "\n".join(violations)


def _imports(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    imports: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.add(node.module)
    return imports
