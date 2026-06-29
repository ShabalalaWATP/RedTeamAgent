from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace

from app.domain.enums import RunState
from app.interfaces.api.routes import runs


def test_event_stream_drains_terminal_event_before_closing(monkeypatch) -> None:
    async def no_sleep(_seconds: float) -> None:
        return None

    monkeypatch.setattr(runs.asyncio, "sleep", no_sleep)
    service = _StreamService()
    response = asyncio.run(runs.stream_events("run-1", _Context(), service))
    text = asyncio.run(_collect(response.body_iterator))

    assert '"state": "intake"' in text
    assert '"state": "completed"' in text


class _Context:
    user = SimpleNamespace(id="user-1")


class _StreamService:
    def __init__(self) -> None:
        self.list_calls = 0

    def list_events(self, _user_id: str, _run_id: str) -> list[SimpleNamespace]:
        self.list_calls += 1
        events = [_event("event-1", RunState.INTAKE.value, "started", 1)]
        if self.list_calls > 1:
            events.append(_event("event-2", RunState.COMPLETED.value, "done", 2))
        return events

    def get_run(self, _user_id: str, _run_id: str) -> SimpleNamespace:
        return SimpleNamespace(state=RunState.COMPLETED.value)


def _event(event_id: str, state: str, message: str, sequence: int) -> SimpleNamespace:
    return SimpleNamespace(
        id=event_id,
        state=state,
        message=message,
        sequence=sequence,
        created_at=datetime.now(UTC),
    )


async def _collect(iterator) -> str:
    chunks: list[str] = []
    async for chunk in iterator:
        chunks.append(chunk if isinstance(chunk, str) else chunk.decode("utf-8"))
    return "".join(chunks)
