from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select

from app.core.database import SessionLocal
from app.infrastructure.db import enterprise_models as em


def governance_payload(
    provider_allowlist: list[str] | None = None,
    model_allowlist: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "provider_allowlist": provider_allowlist or [],
        "model_allowlist": model_allowlist or [],
        "data_classification_allowlist": [],
        "region_allowlist": [],
        "purpose_allowlist": [],
        "approved_domains": ["example.com"],
        "retention_days": 1,
        "preserve_historical_reports": True,
        "legal_hold": False,
        "mfa_required": True,
        "sso_provider": "saml-ready",
        "custom_branding": {"name": "Acme Decisions"},
    }


def backdate_first_notification() -> None:
    with SessionLocal() as session:
        notification = session.scalar(select(em.Notification))
        assert notification is not None
        notification.created_at = datetime.now(UTC) - timedelta(days=3)
        session.commit()
