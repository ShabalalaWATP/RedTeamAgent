from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.application.provider_service import ProviderService
from app.interfaces.api.dependencies import AuthContext, current_context, provider_service, require_csrf
from app.interfaces.api.schemas import (
    ModelCreate,
    ModelPreviewRequest,
    ModelPreviewView,
    ModelView,
    ProfileCreate,
    ProfileView,
    ProviderConnectionCreate,
    ProviderConnectionView,
)

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("/adapters")
def adapter_schemas(service: Annotated[ProviderService, Depends(provider_service)]) -> list[dict[str, object]]:
    return service.adapter_schemas()


@router.post("/connections", response_model=ProviderConnectionView, dependencies=[Depends(require_csrf)])
def create_connection(
    payload: ProviderConnectionCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ProviderService, Depends(provider_service)],
) -> ProviderConnectionView:
    connection = service.create_connection(context.user.id, payload.workspace_id, payload.model_dump())
    return ProviderConnectionView.model_validate(connection)


@router.get("/connections", response_model=list[ProviderConnectionView])
def list_connections(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ProviderService, Depends(provider_service)],
) -> list[ProviderConnectionView]:
    connections = service.list_connections(context.user.id, workspace_id)
    return [ProviderConnectionView.model_validate(item) for item in connections]


@router.post("/connections/{connection_id}/test", dependencies=[Depends(require_csrf)])
def test_connection(
    connection_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ProviderService, Depends(provider_service)],
) -> dict[str, object]:
    return service.test_connection(context.user.id, connection_id)


@router.post(
    "/connections/{connection_id}/models/sync",
    response_model=list[ModelView],
    dependencies=[Depends(require_csrf)],
)
def sync_models(
    connection_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ProviderService, Depends(provider_service)],
) -> list[ModelView]:
    return [ModelView.model_validate(item) for item in service.sync_models(context.user.id, connection_id)]


@router.post("/models/preview", response_model=list[ModelPreviewView], dependencies=[Depends(require_csrf)])
def preview_models(
    payload: ModelPreviewRequest,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ProviderService, Depends(provider_service)],
) -> list[ModelPreviewView]:
    models = service.preview_models(context.user.id, payload.workspace_id, payload.model_dump(exclude={"workspace_id"}))
    return [ModelPreviewView.model_validate(item) for item in models]


@router.post("/models", response_model=ModelView, dependencies=[Depends(require_csrf)])
def create_model(
    payload: ModelCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ProviderService, Depends(provider_service)],
) -> ModelView:
    model = service.create_model(context.user.id, payload.workspace_id, payload.model_dump(exclude={"workspace_id"}))
    return ModelView.model_validate(model)


@router.get("/models", response_model=list[ModelView])
def list_models(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ProviderService, Depends(provider_service)],
) -> list[ModelView]:
    return [ModelView.model_validate(item) for item in service.list_models(context.user.id, workspace_id)]


@router.post("/models/{model_id}/probe", response_model=ModelView, dependencies=[Depends(require_csrf)])
def probe_model(
    model_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ProviderService, Depends(provider_service)],
) -> ModelView:
    return ModelView.model_validate(service.probe_model(context.user.id, model_id))


@router.post("/models/{model_id}/select", response_model=ProfileView, dependencies=[Depends(require_csrf)])
def select_model(
    model_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ProviderService, Depends(provider_service)],
) -> ProfileView:
    return ProfileView.model_validate(service.select_model(context.user.id, model_id))


@router.post("/profiles", response_model=ProfileView, dependencies=[Depends(require_csrf)])
def create_profile(
    payload: ProfileCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ProviderService, Depends(provider_service)],
) -> ProfileView:
    data = payload.model_dump(exclude={"workspace_id"})
    profile = service.create_profile(context.user.id, payload.workspace_id, data)
    return ProfileView.model_validate(profile)


@router.get("/profiles", response_model=list[ProfileView])
def list_profiles(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ProviderService, Depends(provider_service)],
) -> list[ProfileView]:
    return [ProfileView.model_validate(item) for item in service.list_profiles(context.user.id, workspace_id)]
