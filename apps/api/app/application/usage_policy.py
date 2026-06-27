from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class UsageQuota:
    account_type: str
    tier_name: str
    project_limit: int | None
    workflow_total_limit: int | None
    workflow_weekly_limit: int | None

    def remaining_projects(self, used: int) -> int | None:
        return self._remaining(self.project_limit, used)

    def remaining_workflows(self, used: int) -> int | None:
        return self._remaining(self.workflow_total_limit, used)

    def remaining_weekly_workflows(self, used: int) -> int | None:
        return self._remaining(self.workflow_weekly_limit, used)

    @staticmethod
    def _remaining(limit: int | None, used: int) -> int | None:
        if limit is None:
            return None
        return max(0, limit - used)


class UsagePolicy:
    """Centralised account quota policy.

    The policy is intentionally data-driven so a paid tier can be added without
    scattering quota arithmetic through route handlers or repositories.
    """

    def __init__(
        self,
        *,
        user_project_limit: int = 5,
        user_workflow_total_limit: int = 20,
        user_workflow_weekly_limit: int = 10,
        admin_usage_multiplier: int = 3,
    ) -> None:
        self.user_project_limit = user_project_limit
        self.user_workflow_total_limit = user_workflow_total_limit
        self.user_workflow_weekly_limit = user_workflow_weekly_limit
        self.admin_usage_multiplier = admin_usage_multiplier

    def quota_for(self, account_type: str | None) -> UsageQuota:
        normalised = (account_type or "user").lower()
        if normalised == "owner":
            return UsageQuota(
                account_type="owner",
                tier_name="Owner",
                project_limit=None,
                workflow_total_limit=None,
                workflow_weekly_limit=None,
            )
        multiplier = self.admin_usage_multiplier if normalised == "admin" else 1
        tier_name = "Admin" if normalised == "admin" else "User"
        return UsageQuota(
            account_type="admin" if normalised == "admin" else "user",
            tier_name=tier_name,
            project_limit=self.user_project_limit * multiplier,
            workflow_total_limit=self.user_workflow_total_limit * multiplier,
            workflow_weekly_limit=self.user_workflow_weekly_limit * multiplier,
        )
