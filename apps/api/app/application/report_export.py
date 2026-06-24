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
    lines.extend(["", "## Methodology", str(data["methodology"])])
    return "\n".join(lines)


def _html(data: dict[str, Any]) -> str:
    body = html.escape(_markdown(data)).replace("\n", "<br>")
    return f"<!doctype html><html><head><meta charset='utf-8'><title>Report</title></head><body>{body}</body></html>"
