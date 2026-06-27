from __future__ import annotations

from pathlib import Path


def test_production_csp_allows_configured_turnstile_origin() -> None:
    root = Path(__file__).resolve().parents[3]
    caddyfile = root / "deploy" / "cheap-vps" / "Caddyfile"
    text = caddyfile.read_text(encoding="utf-8")

    assert "https://challenges.cloudflare.com" in text
    assert "connect-src 'self' https://challenges.cloudflare.com" in text
    assert "script-src 'self' https://challenges.cloudflare.com" in text
    assert "frame-src https://challenges.cloudflare.com" in text
