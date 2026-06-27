from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

AccountType = Literal["owner", "admin", "user"]
AccountStatus = Literal["active", "suspended", "banned", "deleted"]
AdminScope = Literal["none", "all", "selected"]


class SiteUserView(BaseModel):
    id: str
    email: str
    is_verified: bool
    account_type: AccountType
    account_status: AccountStatus
    status_message: str = ""
    admin_scope: AdminScope = "none"
    admin_managed_user_ids: list[str] = Field(default_factory=list)
    created_at: datetime
    last_login_at: datetime | None = None
    last_login_ip: str | None = None
    last_seen_at: datetime | None = None
    last_seen_ip: str | None = None
    run_count: int = 0


class SiteUserUpdate(BaseModel):
    account_type: AccountType | None = None
    account_status: AccountStatus | None = None
    status_message: str = Field(default="", max_length=500)
    admin_scope: AdminScope | None = None
    admin_managed_user_ids: list[str] = Field(default_factory=list, max_length=500)


class SiteVisitCreate(BaseModel):
    path: str = Field(default="/", max_length=500)


class SiteVisitView(BaseModel):
    id: str
    user_id: str | None = None
    ip_address: str
    method: str
    path: str
    user_agent: str
    created_at: datetime
