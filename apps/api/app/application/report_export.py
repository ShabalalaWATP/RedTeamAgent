from __future__ import annotations

import html
import json
from typing import Any


def export_report(data: dict[str, Any], fmt: str) -> str:
    if fmt == "json":
        return json.dumps(data, indent=2, sort_keys=True)
    if fmt == "html":
        return _html(data)
    return _markdown(data)


def export_report_bytes(data: dict[str, Any], fmt: str) -> tuple[bytes, str]:
    if fmt == "pdf":
        return _pdf(data), "application/pdf"
    content = export_report(data, fmt)
    media_type = "application/json" if fmt == "json" else "text/html" if fmt == "html" else "text/markdown"
    return content.encode("utf-8"), media_type


def _markdown(data: dict[str, Any]) -> str:
    findings = data.get("findings", [])
    context_packs = data.get("context_packs", [])
    retrieved_evidence = data.get("retrieved_evidence", [])
    lines = [
        f"# {data['title']}",
        "",
        f"**Recommendation:** {data['provisional_recommendation']}",
        "",
        "## Executive Summary",
        str(data["executive_summary"]),
        "",
        "## Top Risks",
    ]
    for finding in findings:
        lines.extend(
            [
                f"- **{finding['severity']}** {finding['title']}",
                f"  - Confidence: {finding['confidence']}",
                f"  - Evidence: {finding['evidence_label']}",
            ]
        )
        if finding.get("evidence_excerpt"):
            lines.append(f"  - Excerpt: {finding['evidence_excerpt']}")
    if retrieved_evidence:
        lines.extend(["", "## Retrieved Evidence"])
        for item in retrieved_evidence:
            lines.append(f"- {item['locator']}: {item['excerpt']}")
    if context_packs:
        lines.extend(["", "## Context Packs"])
        for pack in context_packs:
            lines.append(f"- {pack['name']} ({pack['agent_key']}) v{pack['version']}")
    if data.get("pre_mortem"):
        lines.extend(["", "## Pre-mortem"])
        lines.extend(f"- {item}" for item in data["pre_mortem"])
    if data.get("validation_experiments"):
        lines.extend(["", "## Validation Experiments"])
        lines.extend(f"- {item}" for item in data["validation_experiments"])
    if data.get("action_items"):
        lines.extend(["", "## Action Tracking"])
        for item in data["action_items"]:
            lines.append(f"- [{item['status']}] {item['title']} - {item['owner']}")
    lines.extend(["", "## Methodology", str(data["methodology"])])
    return "\n".join(lines)


def _html(data: dict[str, Any]) -> str:
    body = html.escape(_markdown(data)).replace("\n", "<br>")
    return f"<!doctype html><html><head><meta charset='utf-8'><title>Report</title></head><body>{body}</body></html>"


def _pdf(data: dict[str, Any]) -> bytes:
    text = _markdown(data).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    lines = text.splitlines()[:55]
    content_lines = ["BT", "/F1 11 Tf", "50 790 Td"]
    for index, line in enumerate(lines):
        if index:
            content_lines.append("0 -14 Td")
        content_lines.append(f"({line[:100]}) Tj")
    content_lines.append("ET")
    stream = "\n".join(content_lines).encode("latin-1", errors="replace")
    objects = [
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
        (
            b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n"
        ),
        b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
        f"5 0 obj << /Length {len(stream)} >> stream\n".encode() + stream + b"\nendstream endobj\n",
    ]
    body = b"%PDF-1.4\n"
    offsets = [0]
    for obj in objects:
        offsets.append(len(body))
        body += obj
    xref_at = len(body)
    xref = [b"xref\n0 6\n", b"0000000000 65535 f \n"]
    xref.extend(f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:])
    trailer = f"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF\n".encode()
    return body + b"".join(xref) + trailer
