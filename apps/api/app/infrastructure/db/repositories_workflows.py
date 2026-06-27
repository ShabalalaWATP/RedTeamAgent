from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import delete, desc, func, select
from sqlalchemy.orm import Session

from app.domain.enums import RunState
from app.infrastructure.db import models
from app.infrastructure.db.workflow_summary import workflow_summary


class WorkflowRepositoryMixin:
    session: Session

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

    def count_user_workflows(self, user_id: str) -> int:
        statement = select(func.count()).select_from(models.Run).where(models.Run.created_by_user_id == user_id)
        return int(self.session.scalar(statement) or 0)

    def count_user_workflow_creations_since(self, user_id: str, since: datetime) -> int:
        statement = select(func.count()).select_from(models.AuditEvent).where(
            models.AuditEvent.actor_user_id == user_id,
            models.AuditEvent.action == "run.started",
            models.AuditEvent.created_at >= since,
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
            .outerjoin(models.Project, models.Project.id == models.Review.project_id)
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

    def delete_run(self, run_id: str) -> None:
        self.session.execute(delete(models.Report).where(models.Report.run_id == run_id))
        self.session.execute(delete(models.RunEvent).where(models.RunEvent.run_id == run_id))
        run = self.session.get(models.Run, run_id)
        if run:
            self.session.delete(run)

    def add_run_event(self, run_id: str, state: str, message: str) -> models.RunEvent:
        sequence = len(self.list_run_events(run_id)) + 1
        event = models.RunEvent(run_id=run_id, state=state, message=message, sequence=sequence)
        self.session.add(event)
        self.session.flush()
        return event

    def list_run_events(self, run_id: str) -> list[models.RunEvent]:
        statement = (
            select(models.RunEvent).where(models.RunEvent.run_id == run_id).order_by(models.RunEvent.sequence)
        )
        return list(self.session.scalars(statement))

    def create_report(self, workspace_id: str, run_id: str, data: dict[str, Any]) -> models.Report:
        report = models.Report(workspace_id=workspace_id, run_id=run_id, data=data)
        self.session.add(report)
        self.session.flush()
        return report

    def get_report_by_run(self, run_id: str) -> models.Report | None:
        return self.session.scalar(select(models.Report).where(models.Report.run_id == run_id))
