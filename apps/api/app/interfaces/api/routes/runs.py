from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from fastapi.responses import PlainTextResponse, StreamingResponse

from app.application.report_export import export_report
from app.application.workflow_service import WorkflowService
from app.interfaces.api.dependencies import (
    AuthContext,
    current_context,
    rate_limit_expensive,
    require_csrf,
    workflow_service,
)
from app.interfaces.api.schemas import ReportView, RunEventView, RunView, WorkflowSummaryView

router = APIRouter(tags=["runs"])


@router.post(
    "/reviews/{review_id}/runs",
    response_model=RunView,
    dependencies=[Depends(require_csrf), Depends(rate_limit_expensive)],
)
def start_run(
    review_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[WorkflowService, Depends(workflow_service)],
) -> RunView:
    return RunView.model_validate(service.start_run(context.user.id, review_id))


@router.post("/runs/{run_id}/cancel", response_model=RunView, dependencies=[Depends(require_csrf)])
def cancel_run(
    run_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[WorkflowService, Depends(workflow_service)],
) -> RunView:
    return RunView.model_validate(service.cancel_run(context.user.id, run_id))


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
        for event in events:
            yield f"event: {event.state}\ndata: {event.message}\n\n"
            await asyncio.sleep(0)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/runs/{run_id}/report", response_model=ReportView)
def get_report(
    run_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[WorkflowService, Depends(workflow_service)],
) -> ReportView:
    return ReportView.model_validate(service.get_report(context.user.id, run_id))


@router.get("/runs/{run_id}/report/export")
def export(
    run_id: str,
    fmt: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[WorkflowService, Depends(workflow_service)],
) -> Response:
    report = service.get_report(context.user.id, run_id)
    content = export_report(report.data, fmt)
    media_type = "application/json" if fmt == "json" else "text/html" if fmt == "html" else "text/markdown"
    return PlainTextResponse(content, media_type=media_type)
