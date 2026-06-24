from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.application.project_service import ProjectService
from app.interfaces.api.dependencies import AuthContext, current_context, project_service, require_csrf
from app.interfaces.api.schemas import ProjectCreate, ProjectUpdate, ProjectView

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectView])
def list_projects(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ProjectService, Depends(project_service)],
) -> list[ProjectView]:
    return [ProjectView.model_validate(item) for item in service.list_projects(context.user.id, workspace_id)]


@router.post("", response_model=ProjectView, dependencies=[Depends(require_csrf)])
def create_project(
    payload: ProjectCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ProjectService, Depends(project_service)],
) -> ProjectView:
    project = service.create_project(context.user.id, payload.workspace_id, payload.title, payload.description)
    return ProjectView.model_validate(project)


@router.put("/{project_id}", response_model=ProjectView, dependencies=[Depends(require_csrf)])
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ProjectService, Depends(project_service)],
) -> ProjectView:
    project = service.update_project(context.user.id, project_id, payload.title, payload.description)
    return ProjectView.model_validate(project)


@router.delete("/{project_id}", status_code=204, dependencies=[Depends(require_csrf)])
def delete_project(
    project_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ProjectService, Depends(project_service)],
) -> None:
    service.delete_project(context.user.id, project_id)
