from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, Response
from fastapi.responses import PlainTextResponse, StreamingResponse

from app.application.report_export import export_report_bytes
from app.application.workflow_service import WorkflowService
from app.core.config import Settings, get_settings
from app.domain.enums import RunState
from app.infrastructure.workflow.background import execute_workflow_background
from app.interfaces.api.dependencies import (
    AuthContext,
    current_context,
    rate_limit_expensive,
    require_csrf,
    workflow_service,
)
from app.interfaces.api.schemas import (
    ReportComparisonView,
    ReportView,
    RunEventView,
    RunView,
    UsageLimitsView,
    WorkflowSummaryView,
)

router = APIRouter(tags=["runs"])


@router.post(
    "/reviews/{review_id}/runs",
    response_model=RunView,
    dependencies=[Depends(require_csrf), Depends(rate_limit_expensive)],
)
def start_run(
    review_id: str,
    background_tasks: BackgroundTasks,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[WorkflowService, Depends(workflow_service)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> RunView:
    run = service.start_run(context.user.id, review_id, execute_immediately=False)
    background_tasks.add_task(
        execute_workflow_background,
        run.id,
        settings.self_hosted_provider_mode,
        settings.allow_fake_provider,
        settings.app_secret_key,
        context.user.id,
    )
    return RunView.model_validate(run)


@router.get("/usage/limits", response_model=UsageLimitsView)
def usage_limits(
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[WorkflowService, Depends(workflow_service)],
) -> UsageLimitsView:
    return UsageLimitsView.model_validate(service.usage_limits(context.user.id))


@router.post("/runs/{run_id}/cancel", response_model=RunView, dependencies=[Depends(require_csrf)])
def cancel_run(
    run_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[WorkflowService, Depends(workflow_service)],
) -> RunView:
    return RunView.model_validate(service.cancel_run(context.user.id, run_id))


@router.delete("/runs/{run_id}", status_code=204, dependencies=[Depends(require_csrf)])
def delete_workflow(
    run_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[WorkflowService, Depends(workflow_service)],
) -> None:
    service.delete_workflow(context.user.id, run_id)


@router.get("/runs/{run_id}", response_model=RunView)
def get_run(
    run_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[WorkflowService, Depends(workflow_service)],
) -> RunView:
    return RunView.model_validate(service.get_run(context.user.id, run_id))


@router.get("/workspaces/{workspace_id}/workflows", response_model=list[WorkflowSummaryView])
def list_workflows(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[WorkflowService, Depends(workflow_service)],
) -> list[WorkflowSummaryView]:
    return [WorkflowSummaryView.model_validate(item) for item in service.list_workflows(context.user.id, workspace_id)]


@router.get("/runs/{run_id}/events", response_model=list[RunEventView])
def list_events(
    run_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[WorkflowService, Depends(workflow_service)],
) -> list[RunEventView]:
    return [RunEventView.model_validate(event) for event in service.list_events(context.user.id, run_id)]


@router.get("/runs/{run_id}/events/stream")
async def stream_events(
    run_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[WorkflowService, Depends(workflow_service)],
) -> StreamingResponse:
    events = service.list_events(context.user.id, run_id)

    async def event_stream() -> AsyncIterator[str]:
        last_sequence = 0
        for event in events:
            last_sequence = event.sequence
            yield _sse_event(event)
        for _ in range(120):
            run = service.get_run(context.user.id, run_id)
            if run.state in {RunState.COMPLETED.value, RunState.FAILED.value, RunState.CANCELLED.value}:
                break
            await asyncio.sleep(0.25)
            for event in service.list_events(context.user.id, run_id):
                if event.sequence > last_sequence:
                    last_sequence = event.sequence
                    yield _sse_event(event)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


def _sse_event(event: Any) -> str:
    payload = {
        "id": event.id,
        "state": event.state,
        "message": event.message,
        "sequence": event.sequence,
        "created_at": event.created_at.isoformat(),
    }
    return f"id: {event.sequence}\ndata: {json.dumps(payload)}\n\n"


@router.get("/runs/{run_id}/report", response_model=ReportView)
def get_report(
    run_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[WorkflowService, Depends(workflow_service)],
) -> ReportView:
    return ReportView.model_validate(service.get_report(context.user.id, run_id))


@router.get("/runs/{run_id}/report/compare", response_model=ReportComparisonView)
def compare_report(
    run_id: str,
    other_run_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[WorkflowService, Depends(workflow_service)],
) -> ReportComparisonView:
    return ReportComparisonView.model_validate(service.compare_reports(context.user.id, run_id, other_run_id))


@router.get("/runs/{run_id}/report/export")
def export(
    run_id: str,
    fmt: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[WorkflowService, Depends(workflow_service)],
) -> Response:
    report = service.get_report(context.user.id, run_id)
    content, media_type = export_report_bytes(report.data, fmt)
    if fmt == "pdf":
        return Response(content, media_type=media_type)
    return PlainTextResponse(content.decode("utf-8"), media_type=media_type)
