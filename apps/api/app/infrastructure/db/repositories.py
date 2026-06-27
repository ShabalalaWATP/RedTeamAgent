from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.domain.enums import RunState, SourceState, WorkspaceRole
from app.infrastructure.auth.security import new_session_expiry
from app.infrastructure.db import models
from app.infrastructure.db.workflow_summary import workflow_summary
from app.infrastructure.search.evidence_search import EvidenceCandidate, embedding_for_text, rank_candidates


class SqlRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create_user(self, email: str, password_hash: str) -> models.User:
        account_type = "owner" if not self.session.scalar(select(func.count()).select_from(models.User)) else "user"
        user = models.User(email=email.lower(), password_hash=password_hash, account_type=account_type)
        self.session.add(user)
        self.session.flush()
        return user

    def get_user_by_email(self, email: str) -> models.User | None:
        return self.session.scalar(select(models.User).where(models.User.email == email.lower()))

    def get_user(self, user_id: str) -> models.User | None:
        return self.session.get(models.User, user_id)

    def verify_user(self, user_id: str) -> None:
        user = self.session.get(models.User, user_id)
        if user:
            user.is_verified = True

    def update_password(self, user_id: str, password_hash: str) -> None:
        user = self.session.get(models.User, user_id)
        if user:
            user.password_hash = password_hash

    def get_mfa_setting(self, user_id: str) -> models.UserMfaSetting | None:
        return self.session.get(models.UserMfaSetting, user_id)

    def upsert_mfa_setting(
        self,
        user_id: str,
        secret_ciphertext: str,
        recovery_code_hashes: list[str],
        *,
        enabled: bool,
    ) -> models.UserMfaSetting:
        setting = self.session.get(models.UserMfaSetting, user_id)
        if setting is None:
            setting = models.UserMfaSetting(user_id=user_id, secret_ciphertext=secret_ciphertext)
            self.session.add(setting)
        setting.secret_ciphertext = secret_ciphertext
        setting.recovery_code_hashes = recovery_code_hashes
        setting.enabled = enabled
        setting.enabled_at = models.utc_now() if enabled else None
        self.session.flush()
        return setting

    def enable_mfa_setting(self, user_id: str) -> None:
        setting = self.session.get(models.UserMfaSetting, user_id)
        if setting:
            setting.enabled = True
            setting.enabled_at = models.utc_now()

    def disable_mfa_setting(self, user_id: str) -> None:
        setting = self.session.get(models.UserMfaSetting, user_id)
        if setting:
            self.session.delete(setting)

    def update_mfa_recovery_hashes(self, user_id: str, recovery_code_hashes: list[str]) -> None:
        setting = self.session.get(models.UserMfaSetting, user_id)
        if setting:
            setting.recovery_code_hashes = recovery_code_hashes

    def create_session(self, user_id: str, csrf_token: str) -> models.SessionRecord:
        record = models.SessionRecord(
            user_id=user_id,
            csrf_token=csrf_token,
            expires_at=new_session_expiry(),
        )
        self.session.add(record)
        self.session.flush()
        return record

    def get_session(self, session_id: str) -> models.SessionRecord | None:
        record = self.session.get(models.SessionRecord, session_id)
        if record is None:
            return None
        expires_at = record.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at > datetime.now(UTC):
            return record
        return None

    def delete_session(self, session_id: str) -> None:
        record = self.session.get(models.SessionRecord, session_id)
        if record:
            self.session.delete(record)

    def create_personal_workspace(self, user_id: str, email: str) -> models.Workspace:
        workspace = models.Workspace(name=f"{email}'s workspace")
        self.session.add(workspace)
        self.session.flush()
        self.session.add(
            models.WorkspaceMembership(
                workspace_id=workspace.id,
                user_id=user_id,
                role=WorkspaceRole.OWNER.value,
            )
        )
        self.session.flush()
        return workspace

    def membership_role(self, workspace_id: str, user_id: str) -> str | None:
        membership = self.session.scalar(
            select(models.WorkspaceMembership).where(
                models.WorkspaceMembership.workspace_id == workspace_id,
                models.WorkspaceMembership.user_id == user_id,
            )
        )
        return membership.role if membership else None

    def list_workspaces(self, user_id: str) -> list[models.Workspace]:
        return list(
            self.session.scalars(
                select(models.Workspace)
                .join(models.WorkspaceMembership, models.WorkspaceMembership.workspace_id == models.Workspace.id)
                .where(models.WorkspaceMembership.user_id == user_id)
            )
        )
    def create_project(self, workspace_id: str, title: str, description: str) -> models.Project:
        project = models.Project(workspace_id=workspace_id, title=title, description=description)
        self.session.add(project)
        self.session.flush()
        return project

    def get_project(self, project_id: str) -> models.Project | None:
        return self.session.get(models.Project, project_id)

    def list_projects(self, workspace_id: str) -> list[models.Project]:
        return list(self.session.scalars(select(models.Project).where(models.Project.workspace_id == workspace_id)))

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

    def create_review(self, workspace_id: str, project_id: str, data: dict[str, Any]) -> models.Review:
        review = models.Review(workspace_id=workspace_id, project_id=project_id, **data)
        self.session.add(review)
        self.session.flush()
        return review

    def get_review(self, review_id: str) -> models.Review | None:
        return self.session.get(models.Review, review_id)

    def list_reviews(self, project_id: str) -> list[models.Review]:
        return list(self.session.scalars(select(models.Review).where(models.Review.project_id == project_id)))

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
        rows = self._evidence_rows(workspace_id, review_id, query, max(limit * 4, limit))
        candidates = [
            EvidenceCandidate(
                source_id=source.id,
                source_filename=source.filename,
                locator=chunk.locator,
                text=chunk.text,
                embedding=[float(value) for value in chunk.embedding],
            )
            for chunk, source in rows
        ]
        return rank_candidates(candidates, query, limit)

    def _evidence_rows(self, workspace_id: str, review_id: str, query: str, limit: int) -> list[Any]:
        statement = (
            select(models.EvidenceChunk, models.Source)
            .join(models.Source, models.Source.id == models.EvidenceChunk.source_id)
            .where(models.EvidenceChunk.workspace_id == workspace_id, models.Source.review_id == review_id)
        )
        if self.session.get_bind().dialect.name == "postgresql" and query.strip():
            ts_query = func.websearch_to_tsquery("english", query)
            vector = func.to_tsvector("english", models.EvidenceChunk.text)
            query_embedding = embedding_for_text(query)
            ranked = statement.where(vector.op("@@")(ts_query)).order_by(
                desc(func.ts_rank_cd(vector, ts_query)),
                models.EvidenceChunk.embedding.cosine_distance(query_embedding),
            )
            rows = list(self.session.execute(ranked.limit(limit)).all())
            if rows:
                return rows
        return list(self.session.execute(statement.limit(limit)).all())

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

    def create_provider_connection(self, workspace_id: str, data: dict[str, Any]) -> models.ProviderConnection:
        connection = models.ProviderConnection(workspace_id=workspace_id, **data)
        self.session.add(connection)
        self.session.flush()
        return connection

    def get_provider_connection(self, connection_id: str) -> models.ProviderConnection | None:
        return self.session.get(models.ProviderConnection, connection_id)

    def list_provider_connections(self, workspace_id: str) -> list[models.ProviderConnection]:
        statement = select(models.ProviderConnection).where(
            models.ProviderConnection.workspace_id == workspace_id
        )
        return list(self.session.scalars(statement))

    def create_model(self, workspace_id: str, data: dict[str, Any]) -> models.ModelRecord:
        model = models.ModelRecord(workspace_id=workspace_id, **data)
        self.session.add(model)
        self.session.flush()
        return model

    def get_model(self, model_id: str) -> models.ModelRecord | None:
        return self.session.get(models.ModelRecord, model_id)

    def get_model_by_identifier(
        self,
        workspace_id: str,
        provider_connection_id: str,
        model_identifier: str,
    ) -> models.ModelRecord | None:
        statement = select(models.ModelRecord).where(
            models.ModelRecord.workspace_id == workspace_id,
            models.ModelRecord.provider_connection_id == provider_connection_id,
            models.ModelRecord.model_identifier == model_identifier,
        )
        return self.session.scalar(statement)

    def list_models(self, workspace_id: str) -> list[models.ModelRecord]:
        statement = select(models.ModelRecord).where(models.ModelRecord.workspace_id == workspace_id)
        return list(self.session.scalars(statement))

    def update_model_probe(
        self,
        model_id: str,
        capabilities: list[str],
        provenance: str,
        verified: bool,
        probe_result: dict[str, Any],
    ) -> models.ModelRecord:
        model = self.session.get(models.ModelRecord, model_id)
        if model is None:
            raise LookupError(model_id)
        model.capabilities = capabilities
        model.provenance = provenance
        model.verified = verified
        model.probe_result = probe_result
        return model

    def create_profile(self, workspace_id: str, data: dict[str, Any]) -> models.ModelProfile:
        profile = models.ModelProfile(workspace_id=workspace_id, **data)
        self.session.add(profile)
        self.session.flush()
        return profile

    def list_profiles(self, workspace_id: str) -> list[models.ModelProfile]:
        statement = select(models.ModelProfile).where(models.ModelProfile.workspace_id == workspace_id)
        return list(self.session.scalars(statement))

    def create_run(
        self, workspace_id: str, review_id: str, routing_plan: dict[str, Any], created_by_user_id: str | None
    ) -> models.Run:
        run = models.Run(
            workspace_id=workspace_id, review_id=review_id, created_by_user_id=created_by_user_id,
            state=RunState.INTAKE.value, routing_plan=routing_plan,
        )
        self.session.add(run)
        self.session.flush()
        return run

    def count_user_runs_since(self, user_id: str, since: datetime) -> int:
        statement = select(func.count()).select_from(models.Run).where(
            models.Run.created_by_user_id == user_id, models.Run.created_at >= since
        )
        return int(self.session.scalar(statement) or 0)

    def get_run(self, run_id: str) -> models.Run | None:
        run = self.session.get(models.Run, run_id)
        if run is not None:
            self.session.refresh(run)
        return run

    def list_workflows(self, workspace_id: str) -> list[dict[str, Any]]:
        statement = (
            select(models.Run, models.Review, models.Project, models.Report)
            .join(models.Review, models.Review.id == models.Run.review_id)
            .join(models.Project, models.Project.id == models.Review.project_id)
            .outerjoin(models.Report, models.Report.run_id == models.Run.id)
            .where(models.Run.workspace_id == workspace_id)
            .order_by(desc(models.Run.created_at))
        )
        return [
            workflow_summary(run, review, project, report)
            for run, review, project, report in self.session.execute(statement).all()
        ]

    def update_run(self, run_id: str, state: str, usage: dict[str, Any] | None = None) -> None:
        run = self.session.get(models.Run, run_id)
        if run:
            run.state = state
            if usage is not None:
                run.usage = usage

    def add_run_event(self, run_id: str, state: str, message: str) -> models.RunEvent:
        sequence = len(self.list_run_events(run_id)) + 1
        event = models.RunEvent(run_id=run_id, state=state, message=message, sequence=sequence)
        self.session.add(event)
        self.session.flush()
        return event

    def list_run_events(self, run_id: str) -> list[models.RunEvent]:
        return list(
            self.session.scalars(
                select(models.RunEvent).where(models.RunEvent.run_id == run_id).order_by(models.RunEvent.sequence)
            )
        )

    def create_report(self, workspace_id: str, run_id: str, data: dict[str, Any]) -> models.Report:
        report = models.Report(workspace_id=workspace_id, run_id=run_id, data=data)
        self.session.add(report)
        self.session.flush()
        return report

    def get_report_by_run(self, run_id: str) -> models.Report | None:
        return self.session.scalar(select(models.Report).where(models.Report.run_id == run_id))

    def audit(self, workspace_id: str | None, actor_user_id: str | None, action: str, metadata: dict[str, Any]) -> None:
        self.session.add(
            models.AuditEvent(
                workspace_id=workspace_id,
                actor_user_id=actor_user_id,
                action=action,
                metadata_json=metadata,
            )
        )
    def commit(self) -> None:
        self.session.commit()
