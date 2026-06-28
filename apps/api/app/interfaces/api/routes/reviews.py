from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile

from app.application.review_service import ReviewService
from app.domain.exceptions import ValidationFailure
from app.interfaces.api.dependencies import (
    AuthContext,
    current_context,
    rate_limit_expensive,
    require_csrf,
    review_service,
)
from app.interfaces.api.schemas import (
    ContextPackCreate,
    ContextPackView,
    PastedTextRequest,
    RepositorySourceRequest,
    ReviewCreate,
    ReviewUpdate,
    ReviewView,
    SourceView,
    StandaloneReviewCreate,
    WebsiteSourceRequest,
    source_view,
)

router = APIRouter(tags=["reviews"])
UPLOAD_READ_CHUNK_BYTES = 1024 * 1024


@router.post("/projects/{project_id}/reviews", response_model=ReviewView, dependencies=[Depends(require_csrf)])
def create_review(
    project_id: str,
    payload: ReviewCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ReviewService, Depends(review_service)],
) -> ReviewView:
    review = service.create_review(context.user.id, project_id, payload.model_dump())
    return ReviewView.model_validate(review)


@router.post("/reviews", response_model=ReviewView, dependencies=[Depends(require_csrf)])
def create_standalone_review(
    payload: StandaloneReviewCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ReviewService, Depends(review_service)],
) -> ReviewView:
    data = payload.model_dump(exclude={"workspace_id"})
    review = service.create_standalone_review(context.user.id, payload.workspace_id, data)
    return ReviewView.model_validate(review)


@router.get("/projects/{project_id}/reviews", response_model=list[ReviewView])
def list_reviews(
    project_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ReviewService, Depends(review_service)],
) -> list[ReviewView]:
    return [ReviewView.model_validate(item) for item in service.list_reviews(context.user.id, project_id)]


@router.put("/reviews/{review_id}", response_model=ReviewView, dependencies=[Depends(require_csrf)])
def update_review(
    review_id: str,
    payload: ReviewUpdate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ReviewService, Depends(review_service)],
) -> ReviewView:
    review = service.update_review(context.user.id, review_id, payload.model_dump())
    return ReviewView.model_validate(review)


@router.post(
    "/reviews/{review_id}/sources/text",
    response_model=SourceView,
    dependencies=[Depends(require_csrf), Depends(rate_limit_expensive)],
)
def add_pasted_text(
    review_id: str,
    payload: PastedTextRequest,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ReviewService, Depends(review_service)],
) -> SourceView:
    return source_view(service.add_pasted_text(context.user.id, review_id, payload.text))


@router.post(
    "/reviews/{review_id}/sources/website",
    response_model=SourceView,
    dependencies=[Depends(require_csrf), Depends(rate_limit_expensive)],
)
def add_website_source(
    review_id: str,
    payload: WebsiteSourceRequest,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ReviewService, Depends(review_service)],
) -> SourceView:
    return source_view(service.add_website(context.user.id, review_id, payload.url))


@router.post(
    "/reviews/{review_id}/sources/repository",
    response_model=SourceView,
    dependencies=[Depends(require_csrf), Depends(rate_limit_expensive)],
)
def add_repository_source(
    review_id: str,
    payload: RepositorySourceRequest,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ReviewService, Depends(review_service)],
) -> SourceView:
    return source_view(service.add_repository(context.user.id, review_id, payload.url))


@router.post(
    "/reviews/{review_id}/sources/upload",
    response_model=SourceView,
    dependencies=[Depends(require_csrf), Depends(rate_limit_expensive)],
)
async def upload_source(
    review_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ReviewService, Depends(review_service)],
    file: Annotated[UploadFile, File()],
) -> SourceView:
    content = await _read_bounded_upload(file, service.max_upload_bytes)
    source = service.add_upload(
        context.user.id,
        review_id,
        file.filename or "source",
        file.content_type or "application/octet-stream",
        content,
    )
    return source_view(source)


async def _read_bounded_upload(file: UploadFile, max_bytes: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(UPLOAD_READ_CHUNK_BYTES)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise ValidationFailure("Upload exceeds the configured size limit.")
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("/context-packs", response_model=ContextPackView, dependencies=[Depends(require_csrf)])
def create_context_pack(
    payload: ContextPackCreate,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ReviewService, Depends(review_service)],
) -> ContextPackView:
    data = payload.model_dump(exclude={"workspace_id"})
    pack = service.create_context_pack(context.user.id, payload.workspace_id, data)
    return ContextPackView.model_validate(pack)


@router.get("/context-packs", response_model=list[ContextPackView])
def list_context_packs(
    workspace_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ReviewService, Depends(review_service)],
) -> list[ContextPackView]:
    return [ContextPackView.model_validate(item) for item in service.list_context_packs(context.user.id, workspace_id)]


@router.get("/reviews/{review_id}/preflight")
def preflight(
    review_id: str,
    context: Annotated[AuthContext, Depends(current_context)],
    service: Annotated[ReviewService, Depends(review_service)],
) -> dict[str, object]:
    return service.preflight(context.user.id, review_id)
