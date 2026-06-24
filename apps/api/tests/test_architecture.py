from __future__ import annotations

from pathlib import Path


def test_application_and_domain_do_not_import_framework_or_orm() -> None:
    root = Path(__file__).resolve().parents[1] / "app"
    forbidden = ["fastapi", "sqlalchemy", "celery", "boto3"]
    checked = list((root / "application").rglob("*.py")) + list((root / "domain").rglob("*.py"))
    for path in checked:
        text = path.read_text(encoding="utf-8")
        for marker in forbidden:
            assert f"import {marker}" not in text
            assert f"from {marker}" not in text


def test_no_provider_agent_or_source_extension_conditionals() -> None:
    root = Path(__file__).resolve().parents[1] / "app"
    text = "\n".join(path.read_text(encoding="utf-8") for path in root.rglob("*.py"))
    assert "if provider ==" not in text
    assert "if agent ==" not in text
    assert "if source_type ==" not in text
