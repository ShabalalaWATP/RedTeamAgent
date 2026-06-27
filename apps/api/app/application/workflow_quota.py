from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from app.application.usage_policy import UsagePolicy
from app.domain.exceptions import RateLimitExceeded


class WorkflowQuotaService:
    def __init__(self, repo: Any, usage_policy: UsagePolicy) -> None:
        self.repo = repo
        self.usage_policy = usage_policy

    def usage_limits(self, user: Any) -> dict[str, Any]:
        user_id = str(user.id)
        quota = self.usage_policy.quota_for(getattr(user, "account_type", "user"))
        week_start = self.week_start()
        projects_used = self.repo.count_user_projects(user_id)
        workflows_used = self.repo.count_user_workflows(user_id)
        workflows_started_this_week = self.repo.count_user_workflow_creations_since(user_id, week_start)
        weekly_remaining = quota.remaining_weekly_workflows(workflows_started_this_week)
        return {
            "account_type": quota.account_type,
            "tier_name": quota.tier_name,
            "project_limit": quota.project_limit,
            "projects_used": projects_used,
            "projects_remaining": quota.remaining_projects(projects_used),
            "workflow_total_limit": quota.workflow_total_limit,
            "workflows_used": workflows_used,
            "workflows_remaining": quota.remaining_workflows(workflows_used),
            "workflow_weekly_limit": quota.workflow_weekly_limit,
            "workflows_started_this_week": workflows_started_this_week,
            "weekly_workflows_remaining": weekly_remaining,
            "resets_at": week_start + timedelta(days=7),
            "daily_review_run_limit": quota.workflow_weekly_limit,
            "runs_started_today": workflows_started_this_week,
            "runs_remaining_today": weekly_remaining,
        }

    def enforce(self, user: Any) -> None:
        user_id = str(user.id)
        quota = self.usage_policy.quota_for(getattr(user, "account_type", "user"))
        workflows_used = self.repo.count_user_workflows(user_id)
        if quota.workflow_total_limit is not None and workflows_used >= quota.workflow_total_limit:
            raise RateLimitExceeded(
                f"{quota.tier_name} workflow storage limit reached ({quota.workflow_total_limit}). "
                "Delete an unused workflow before creating another."
            )
        weekly_used = self.repo.count_user_workflow_creations_since(user_id, self.week_start())
        if quota.workflow_weekly_limit is not None and weekly_used >= quota.workflow_weekly_limit:
            raise RateLimitExceeded(
                f"{quota.tier_name} weekly workflow limit reached ({quota.workflow_weekly_limit}). "
                "Wait until the weekly allowance resets before starting another workflow."
            )

    @staticmethod
    def week_start() -> datetime:
        now = datetime.now(UTC)
        start = now - timedelta(days=now.weekday())
        return start.replace(hour=0, minute=0, second=0, microsecond=0)
