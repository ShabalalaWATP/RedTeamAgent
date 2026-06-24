from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.application.evaluation_service import EvaluationService
from app.interfaces.api.dependencies import AuthContext, current_context, evaluation_service, require_csrf
from app.interfaces.api.schemas import EvaluationResultView

router = APIRouter(tags=["evaluations"])


@router.post(
    "/workspaces/{workspace_id}/evaluations/stage2",
    response_model=EvaluationResultView,
    dependencies=[Depends(require_csrf)],
)
def run_stage2_evaluation(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[EvaluationService, Depends(evaluation_service)],
) -> EvaluationResultView:
    return EvaluationResultView.model_validate(service.run(context.user.id, workspace_id))
