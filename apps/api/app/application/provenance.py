from __future__ import annotations

from hashlib import sha256
from typing import Any


def context_pack_snapshot(packs: list[Any], selected_agents: set[str]) -> list[dict[str, Any]]:
    selected = [pack for pack in packs if pack.agent_key in selected_agents]
    return [
        {
            "id": pack.id,
            "name": pack.name,
            "agent_key": pack.agent_key,
            "version": pack.version,
            "markdown_sha256": sha256(pack.markdown.encode("utf-8")).hexdigest(),
            "load_strategy": "lazy_selected_agent_only",
            "materialised_for_orchestrator": False,
        }
        for pack in sorted(selected, key=lambda item: (item.agent_key, item.name, item.id))
    ]
