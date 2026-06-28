from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domain.enums import SourceState
from app.infrastructure.db import models
from app.infrastructure.db.evidence_queries import search_evidence_chunks
from app.infrastructure.search.evidence_search import embedding_for_text


class ReviewRepositoryMixin:
    session: Session

    def create_project(
        self, workspace_id: str, created_by_user_id: str, title: str, description: str
    ) -> models.Project:
        project = models.Project(
            workspace_id=workspace_id,
            created_by_user_id=created_by_user_id,
            title=title,
            description=description,
        )
        self.session.add(project)
        self.session.flush()
        return project

    def get_project(self, project_id: str) -> models.Project | None:
        return self.session.get(models.Project, project_id)

    def list_projects(self, workspace_id: str) -> list[models.Project]:
        return list(self.session.scalars(select(models.Project).where(models.Project.workspace_id == workspace_id)))

    def count_user_projects(self, user_id: str) -> int:
        statement = select(func.count()).select_from(models.Project).where(models.Project.created_by_user_id == user_id)
        return int(self.session.scalar(statement) or 0)

    def update_project(self, project_id: str, title: str, description: str) -> models.Project:
        project = self.session.get(models.Project, project_id)
        if project is None:
            raise LookupError(project_id)
        project.title = title
        project.description = description
        project.updated_at = models.utc_now()
        return project

    def delete_project(self, project_id: str) -> None:
        project = self.session.get(models.Project, project_id)
        if project:
            self.session.delete(project)

    def create_review(self, workspace_id: str, project_id: str | None, data: dict[str, Any]) -> models.Review:
        review = models.Review(workspace_id=workspace_id, project_id=project_id, **data)
        self.session.add(review)
        self.session.flush()
        return review

    def get_review(self, review_id: str) -> models.Review | None:
        return self.session.get(models.Review, review_id)

    def list_reviews(self, project_id: str) -> list[models.Review]:
        return list(self.session.scalars(select(models.Review).where(models.Review.project_id == project_id)))

    def update_review(self, review_id: str, data: dict[str, Any]) -> models.Review:
        review = self.session.get(models.Review, review_id)
        if review is None:
            raise LookupError(review_id)
        for field in (
            "title",
            "proposal_text",
            "mode",
            "focus_chips",
            "external_research",
            "private_research",
            "domain_allowlist",
            "domain_blocklist",
        ):
            if field in data:
                setattr(review, field, data[field])
        self.session.flush()
        return review

    def add_source(self, data: dict[str, Any]) -> models.Source:
        source = models.Source(state=SourceState.PENDING.value, **data)
        self.session.add(source)
        self.session.flush()
        return source

    def get_source(self, source_id: str) -> models.Source | None:
        return self.session.get(models.Source, source_id)

    def list_sources(self, review_id: str) -> list[models.Source]:
        return list(self.session.scalars(select(models.Source).where(models.Source.review_id == review_id)))

    def mark_source(self, source_id: str, state: str, metadata: dict[str, Any], warnings: list[str]) -> None:
        source = self.session.get(models.Source, source_id)
        if source:
            source.state = state
            source.metadata_json = metadata
            source.warnings = warnings

    def add_chunks(self, source_id: str, workspace_id: str, chunks: list[dict[str, str]]) -> None:
        for chunk in chunks:
            self.session.add(
                models.EvidenceChunk(
                    source_id=source_id,
                    workspace_id=workspace_id,
                    locator=chunk["locator"],
                    text=chunk["text"],
                    embedding=embedding_for_text(chunk["text"]),
                )
            )

    def search_evidence_chunks(
        self, workspace_id: str, review_id: str, query: str, limit: int
    ) -> list[dict[str, object]]:
        return search_evidence_chunks(self.session, workspace_id, review_id, query, limit)

    def create_context_pack(self, workspace_id: str, data: dict[str, Any]) -> models.ContextPack:
        pack = models.ContextPack(workspace_id=workspace_id, **data)
        self.session.add(pack)
        self.session.flush()
        return pack

    def get_context_pack(self, context_pack_id: str) -> models.ContextPack | None:
        return self.session.get(models.ContextPack, context_pack_id)

    def list_context_packs(self, workspace_id: str) -> list[models.ContextPack]:
        statement = select(models.ContextPack).where(models.ContextPack.workspace_id == workspace_id)
        return list(self.session.scalars(statement))
