from __future__ import annotations

from typing import Any
from uuid import uuid4

from app.application.ports.repositories import RepositoryPorts
from app.application.provenance import context_pack_snapshot
from app.domain.enums import AGENT_LABELS, ReviewMode, SourceState, WorkspaceRole
from app.domain.exceptions import AuthorisationError, NotFoundError
from app.domain.policies import require_write, route_agents, validate_upload


class ReviewService:
    def __init__(self, repo: RepositoryPorts, storage: Any, extractor: Any, max_upload_bytes: int) -> None:
        self.repo = repo
        self.storage = storage
        self.extractor = extractor
        self.max_upload_bytes = max_upload_bytes

    def create_review(self, user_id: str, project_id: str, data: dict[str, Any]) -> Any:
        project = self._require_project_write(user_id, project_id)
        review = self.repo.create_review(project.workspace_id, project.id, data)
        self.repo.audit(project.workspace_id, user_id, "review.created", {"review_id": review.id})
        self.repo.commit()
        return review

    def list_reviews(self, user_id: str, project_id: str) -> list[Any]:
        project = self._require_project_member(user_id, project_id)
        return self.repo.list_reviews(project.id)

    def add_pasted_text(self, user_id: str, review_id: str, text: str) -> Any:
        content = text.encode("utf-8")
        return self.add_upload(user_id, review_id, "proposal.md", "text/markdown", content)

    def add_upload(self, user_id: str, review_id: str, filename: str, content_type: str, content: bytes) -> Any:
        review = self._require_review_write(user_id, review_id)
        safe_name = validate_upload(content_type, filename, len(content), self.max_upload_bytes)
        object_key = f"{review.workspace_id}/{review.id}/{uuid4()}-{safe_name}"
        self.storage.put(object_key, content, content_type)
        source = self.repo.add_source(
            {
                "workspace_id": review.workspace_id,
                "review_id": review.id,
                "filename": safe_name,
                "content_type": content_type,
                "object_key": object_key,
                "metadata_json": {"bytes": len(content)},
                "warnings": [],
            }
        )
        self._extract_source(source.id, review.workspace_id, safe_name, content_type, content)
        self.repo.audit(review.workspace_id, user_id, "source.ingested", {"source_id": source.id})
        self.repo.commit()
        return self.repo.get_source(source.id)

    def create_context_pack(self, user_id: str, workspace_id: str, data: dict[str, Any]) -> Any:
        require_write(self._role(user_id, workspace_id))
        pack = self.repo.create_context_pack(workspace_id, data)
        self.repo.audit(workspace_id, user_id, "context_pack.created", {"context_pack_id": pack.id})
        self.repo.commit()
        return pack

    def list_context_packs(self, user_id: str, workspace_id: str) -> list[Any]:
        self._role(user_id, workspace_id)
        return self.repo.list_context_packs(workspace_id)

    def preflight(self, user_id: str, review_id: str) -> dict[str, Any]:
        review = self._require_review_member(user_id, review_id)
        decision = route_agents(ReviewMode(review.mode), review.focus_chips)
        sources = self.repo.list_sources(review.id)
        selected_agent_keys = {agent.value for agent in decision.selected_agents}
        return {
            "review_id": review.id,
            "sources": [self._source_view(source) for source in sources],
            "selected_mode": review.mode,
            "selected_agents": [
                {"key": agent.value, "label": AGENT_LABELS[agent], "reason": "Relevant to review mode or focus."}
                for agent in decision.selected_agents
            ],
            "excluded_agents": [
                {"key": agent.value, "label": AGENT_LABELS[agent], "reason": reason}
                for agent, reason in decision.excluded_agents.items()
            ],
            "external_research": False,
            "mode_budget": decision.mode_budget,
            "challenge_passes": decision.challenge_passes,
            "report_depth": decision.report_depth,
            "capability_warnings": self._capability_warnings(review.workspace_id),
            "context_packs": context_pack_snapshot(
                self.repo.list_context_packs(review.workspace_id),
                selected_agent_keys,
            ),
        }

    def _extract_source(
        self,
        source_id: str,
        workspace_id: str,
        filename: str,
        content_type: str,
        content: bytes,
    ) -> None:
        try:
            extracted = self.extractor.extract(filename, content_type, content)
            chunks = [{"locator": chunk.locator, "text": chunk.text} for chunk in extracted.chunks]
            self.repo.add_chunks(source_id, workspace_id, chunks)
            state = SourceState.INGESTED.value if chunks else SourceState.FAILED.value
            warnings = extracted.warnings if chunks else [*extracted.warnings, "No evidence chunks were extracted."]
            self.repo.mark_source(source_id, state, extracted.metadata, warnings)
        except Exception as exc:
            self.repo.mark_source(source_id, SourceState.FAILED.value, {}, [str(exc)])

    def _capability_warnings(self, workspace_id: str) -> list[str]:
        models = self.repo.list_models(workspace_id)
        if not models:
            return ["No model profiles configured. Fake provider route will be used for local demo."]
        return []

    def _require_project_member(self, user_id: str, project_id: str) -> Any:
        project = self.repo.get_project(project_id)
        if project is None:
            raise NotFoundError("Project not found.")
        self._role(user_id, project.workspace_id)
        return project

    def _require_project_write(self, user_id: str, project_id: str) -> Any:
        project = self._require_project_member(user_id, project_id)
        require_write(self._role(user_id, project.workspace_id))
        return project

    def _require_review_member(self, user_id: str, review_id: str) -> Any:
        review = self.repo.get_review(review_id)
        if review is None:
            raise NotFoundError("Review not found.")
        self._role(user_id, review.workspace_id)
        return review

    def _require_review_write(self, user_id: str, review_id: str) -> Any:
        review = self._require_review_member(user_id, review_id)
        require_write(self._role(user_id, review.workspace_id))
        return review

    def _role(self, user_id: str, workspace_id: str) -> WorkspaceRole:
        role = self.repo.membership_role(workspace_id, user_id)
        if role is None:
            raise AuthorisationError("Workspace access denied.")
        return WorkspaceRole(role)

    @staticmethod
    def _source_view(source: Any) -> dict[str, Any]:
        return {
            "id": source.id,
            "filename": source.filename,
            "content_type": source.content_type,
            "state": source.state,
            "warnings": source.warnings,
            "metadata": source.metadata_json,
        }
