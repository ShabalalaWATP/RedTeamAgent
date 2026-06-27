from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Request

from app.application.site_admin_service import SiteAdminService
from app.infrastructure.db import models
from app.infrastructure.db.repositories import SqlRepository
from app.infrastructure.db.site_admin_repository import SiteAdminRepository
from app.interfaces.api.dependencies import (
    AuthContext,
    client_identity,
    current_context,
    get_repo,
    rate_limit_site_visit,
    require_csrf,
)
from app.interfaces.api.site_admin_schemas import SiteUserUpdate, SiteUserView, SiteVisitCreate, SiteVisitView

router = APIRouter(prefix="/site-admin", tags=["site-admin"])


def get_site_admin_repo(repo: Annotated[SqlRepository, Depends(get_repo)]) -> SiteAdminRepository:
    return SiteAdminRepository(repo.session)


def site_admin_service(repo: Annotated[SiteAdminRepository, Depends(get_site_admin_repo)]) -> SiteAdminService:
    return SiteAdminService(repo)


@router.get("/users", response_model=list[SiteUserView])
def list_users(
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[SiteAdminService, Depends(site_admin_service)],
) -> list[SiteUserView]:
    return [SiteUserView.model_validate(item) for item in service.list_users(context.user.id)]


@router.put("/users/{user_id}", response_model=SiteUserView, dependencies=[Depends(require_csrf)])
def update_user(
    user_id: str,
    payload: SiteUserUpdate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[SiteAdminService, Depends(site_admin_service)],
) -> SiteUserView:
    return SiteUserView.model_validate(
        service.update_user(context.user.id, user_id, payload.model_dump(exclude_unset=True))
    )


@router.delete("/users/{user_id}", response_model=SiteUserView, dependencies=[Depends(require_csrf)])
def delete_user(
    user_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[SiteAdminService, Depends(site_admin_service)],
) -> SiteUserView:
    return SiteUserView.model_validate(
        service.update_user(
            context.user.id,
            user_id,
            {"account_status": "deleted", "status_message": "This account has been deleted."},
        )
    )


@router.get("/visits", response_model=list[SiteVisitView])
def list_visits(
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[SiteAdminService, Depends(site_admin_service)],
) -> list[SiteVisitView]:
    return [SiteVisitView.model_validate(item) for item in service.list_visits(context.user.id)]


@router.post("/visits", status_code=204, dependencies=[Depends(rate_limit_site_visit)])
def record_visit(
    payload: SiteVisitCreate,
    request: Request,
    service: Annotated[SiteAdminService, Depends(site_admin_service)],
    session_id: Annotated[str | None, Cookie(alias="rta_session")] = None,
) -> None:
    user_id = None
    if session_id:
        session = service.repo.session.get(models.SessionRecord, session_id)
        user_id = session.user_id if session else None
    service.record_visit(
        user_id,
        client_identity(request),
        request.method,
        payload.path,
        request.headers.get("user-agent", ""),
    )
