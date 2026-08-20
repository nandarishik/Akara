"""Shared mocks and fixtures for superadmin QA tests."""

from __future__ import annotations

from contextlib import ExitStack, contextmanager
from datetime import UTC, datetime, timedelta
from typing import Any, Iterator
from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from tests.conftest import TENANT_FREE, USER_FREE, USER_SUPERADMIN

CONVERSATION_ID = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")

SUPABASE_CLIENT_PATHS = [
    "app.core.superadmin.get_supabase_service_client",
    "app.api.routes.auth.get_supabase_service_client",
    "app.api.routes.system.get_supabase_service_client",
    "app.api.routes.superadmin.tenants.get_supabase_service_client",
    "app.api.routes.superadmin.quota.get_supabase_service_client",
    "app.api.routes.superadmin.plan.get_supabase_service_client",
    "app.api.routes.superadmin.users.get_supabase_service_client",
    "app.api.routes.superadmin.data.get_supabase_service_client",
    "app.api.routes.superadmin.conversations.get_supabase_service_client",
    "app.api.routes.superadmin.billing.get_supabase_service_client",
    "app.api.routes.superadmin.reports.get_supabase_service_client",
    "app.api.routes.superadmin.security.get_supabase_service_client",
    "app.api.routes.superadmin.impersonate.get_supabase_service_client",
    "app.api.routes.superadmin.audit.get_supabase_service_client",
    "app.api.routes.superadmin.system.get_supabase_service_client",
    "app.api.routes.superadmin.sudo.get_supabase_service_client",
    "app.services.superadmin.audit.get_supabase_service_client",
]


def default_tenant_row(*, version: int = 2) -> dict[str, Any]:
    return {
        "id": str(TENANT_FREE),
        "name": "Acme Corp",
        "slug": "acme",
        "plan": "free",
        "plan_status": "active",
        "is_active": True,
        "config": {},
        "feature_overrides": {},
        "version": version,
        "created_at": "2026-01-01T00:00:00+00:00",
        "trial_ends_at": None,
        "internal_notes": "",
        "past_due_since": None,
        "razorpay_subscription_id": None,
        "razorpay_customer_id": None,
    }


class _QueryChain:
    """Fluent Supabase query builder mock."""

    def __init__(self, execute_result: MagicMock):
        self._execute_result = execute_result
        self.not_ = self

    def __getattr__(self, _name: str):
        if _name == "execute":
            return lambda: self._execute_result
        return lambda *_args, **_kwargs: self

    def maybe_single(self):
        return self

    def single(self):
        return self


class _FilterTrackingTable:
    """Table mock that returns rows only when eq-filters match stored row fields."""

    def __init__(self, row: dict[str, Any] | None, *, empty_list: bool = False):
        self._row = row
        self._empty_list = empty_list
        self._filters: dict[str, Any] = {}

    def select(self, *_args, **_kwargs):
        self._filters = {}
        return self

    def update(self, *_args, **_kwargs):
        return self

    def insert(self, *_args, **_kwargs):
        chain = MagicMock()
        chain.execute.return_value = MagicMock(data=[{}])
        return chain

    def delete(self):
        chain = MagicMock()
        chain.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
        return chain

    def eq(self, col: str, val: Any):
        self._filters[col] = val
        return self

    def is_(self, col: str, val: Any):
        return self

    def gt(self, col: str, val: Any):
        return self

    def gte(self, col: str, val: Any):
        return self

    def in_(self, col: str, val: Any):
        return self

    def or_(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def range(self, *_args, **_kwargs):
        return self

    def lt(self, *_args, **_kwargs):
        return self

    @property
    def not_(self):
        return self

    def maybe_single(self):
        return self

    def single(self):
        return self

    def execute(self):
        if self._empty_list:
            return MagicMock(data=[], count=0)
        if not self._row:
            return MagicMock(data=None)
        for key, expected in self._filters.items():
            if str(self._row.get(key)) != str(expected):
                return MagicMock(data=None)
        return MagicMock(data=self._row)


class QaMatrixSupabase:
    """Supabase client mock tuned for superadmin read-endpoint matrix tests."""

    def __init__(
        self,
        *,
        profile_role: str = "superadmin",
        tenant_row: dict[str, Any] | None = None,
        sudo_session: dict[str, Any] | None = None,
        tenant_update_empty: bool = False,
        conversation_exists: bool = True,
    ) -> None:
        self.profile_role = profile_role
        self.tenant_row = tenant_row or default_tenant_row()
        self.sudo_session = sudo_session
        self.tenant_update_empty = tenant_update_empty
        self.conversation_exists = conversation_exists
        self.auth = MagicMock()
        self.auth.admin.get_user_by_id.return_value = MagicMock(
            user=MagicMock(email="user@akara.test")
        )

    def _empty(self) -> MagicMock:
        return MagicMock(data=[], count=0)

    def _single(self, row: dict[str, Any] | None) -> MagicMock:
        return MagicMock(data=row)

    def _list(self, rows: list[dict[str, Any]]) -> MagicMock:
        return MagicMock(data=rows, count=len(rows))

    def rpc(self, _name: str, _params: dict[str, Any] | None = None) -> _QueryChain:
        return _QueryChain(MagicMock(data={"debrief_count": 0, "copilot_calls": 0}))

    def _profiles_table(self) -> MagicMock:
        table = MagicMock()
        profile = {"role": self.profile_role, "tenant_id": str(TENANT_FREE), "id": str(USER_FREE)}
        table.select.return_value.eq.return_value.maybe_single.return_value = _QueryChain(
            self._single(profile)
        )
        table.select.return_value.eq.return_value.single.return_value = _QueryChain(
            self._single(profile)
        )
        table.select.return_value.eq.return_value.execute.return_value = self._empty()
        table.select.return_value.not_.is_.return_value.execute.return_value = self._empty()
        table.select.return_value.order.return_value.range.return_value.execute.return_value = (
            self._empty()
        )
        return table

    def _tenants_table(self) -> MagicMock:
        table = MagicMock()
        table.select.return_value.eq.return_value.maybe_single.return_value = _QueryChain(
            self._single(self.tenant_row)
        )
        table.select.return_value.eq.return_value.single.return_value = _QueryChain(
            self._single(self.tenant_row)
        )
        table.select.return_value.order.return_value.range.return_value.execute.return_value = (
            self._list([self.tenant_row])
        )
        table.select.return_value.limit.return_value.execute.return_value = self._list(
            [self.tenant_row]
        )
        table.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = (
            self._empty()
        )
        update_result = self._empty() if self.tenant_update_empty else self._list([self.tenant_row])
        table.update.return_value.eq.return_value.eq.return_value.execute.return_value = update_result
        table.update.return_value.eq.return_value.execute.return_value = update_result
        return table

    def _empty_table(self) -> _FilterTrackingTable:
        return _FilterTrackingTable(None, empty_list=True)

    def table(self, name: str) -> MagicMock | _FilterTrackingTable:
        if name == "profiles":
            return self._profiles_table()

        if name == "tenants":
            return self._tenants_table()

        if name == "sudo_sessions":
            return _FilterTrackingTable(self.sudo_session if self.sudo_session else None)

        if name == "impersonation_sessions":
            table = MagicMock()
            table.select.return_value.eq.return_value.is_.return_value.gt.return_value.order.return_value.limit.return_value.execute.return_value = (
                self._empty()
            )
            table.update.return_value.eq.return_value.is_.return_value.execute.return_value = (
                self._empty()
            )
            table.insert.return_value.execute.return_value = MagicMock(data=[{}])
            return table

        if name == "conversations":
            convo = {
                "id": str(CONVERSATION_ID),
                "user_id": str(USER_FREE),
                "title": "Test",
                "created_at": "2026-01-01T00:00:00+00:00",
                "updated_at": "2026-01-01T00:00:00+00:00",
            }
            table = MagicMock()
            convo_data = convo if self.conversation_exists else None
            table.select.return_value.eq.return_value.maybe_single.return_value = _QueryChain(
                self._single(convo_data)
            )
            table.select.return_value.eq.return_value.is_.return_value.order.return_value.limit.return_value.execute.return_value = (
                self._empty()
            )
            return table

        if name == "global_settings":
            table = MagicMock()
            table.select.return_value.eq.return_value.maybe_single.return_value = _QueryChain(
                self._single({"value": False})
            )
            table.upsert.return_value.execute.return_value = MagicMock(data=[{}])
            return table

        if name == "audit_log":
            table = MagicMock()
            table.select.return_value.eq.return_value.maybe_single.return_value = _QueryChain(
                self._single(None)
            )
            table.select.return_value.order.return_value.range.return_value.execute.return_value = (
                self._empty()
            )
            table.insert.return_value.execute.return_value = MagicMock(data=[{"id": str(uuid4())}])
            return table

        if name == "cron_runs":
            return self._empty_table()

        if name == "sales_data":
            return self._empty_table()

        if name == "import_jobs":
            table = MagicMock()
            table.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = (
                self._empty()
            )
            table.select.return_value.in_.return_value.execute.return_value = self._empty()
            return table

        if name in ("generated_reports", "delivery_logs", "usage_tracking", "copilot_feedback",
                    "llm_cost_log", "billing_webhook_events", "invoices", "dunning_events",
                    "chat_history", "alert_triggers", "user_events", "secondary_sales_data",
                    "scheme_master"):
            return self._empty_table()

        # Generic empty table fallback
        table = MagicMock()
        table.select.return_value.eq.return_value.maybe_single.return_value = _QueryChain(
            self._single(None)
        )
        table.select.return_value.order.return_value.range.return_value.execute.return_value = (
            self._empty()
        )
        table.select.return_value.order.return_value.limit.return_value.execute.return_value = (
            self._empty()
        )
        table.select.return_value.gte.return_value.execute.return_value = self._empty()
        table.select.return_value.execute.return_value = self._empty()
        return table


def profile_only_supabase(role: str) -> MagicMock:
    """Minimal mock for require_superadmin guard tests."""
    supa = MagicMock()
    profile_mock = MagicMock()
    profile_mock.execute.return_value = MagicMock(data={"role": role})
    supa.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = profile_mock
    return supa


def sudo_session_row(
    *,
    session_id: UUID | None = None,
    user_id: UUID = USER_SUPERADMIN,
    expires_at: datetime | None = None,
) -> dict[str, str]:
    sid = session_id or uuid4()
    exp = expires_at or (datetime.now(UTC) + timedelta(minutes=10))
    return {
        "id": str(sid),
        "user_id": str(user_id),
        "expires_at": exp.isoformat(),
    }


@contextmanager
def patch_supabase_everywhere(client: QaMatrixSupabase | MagicMock) -> Iterator[None]:
    with ExitStack() as stack:
        for path in SUPABASE_CLIENT_PATHS:
            stack.enter_context(patch(path, return_value=client))
        yield


def make_superadmin_client(*, role: str = "superadmin") -> TestClient:
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.main import app

    fake_user = AuthenticatedUser(
        user_id=USER_SUPERADMIN,
        email="superadmin@akara.test",
        role=role,
    )
    app.dependency_overrides[get_current_user] = lambda: fake_user
    return TestClient(app, headers={"Authorization": "Bearer fake-test-token"})


def make_non_superadmin_client(*, jwt_role: str = "admin") -> TestClient:
    from app.core.auth import AuthenticatedUser, get_current_user
    from app.main import app

    fake_user = AuthenticatedUser(user_id=USER_FREE, email="free@akara.test", role=jwt_role)
    app.dependency_overrides[get_current_user] = lambda: fake_user
    return TestClient(app, headers={"Authorization": "Bearer fake-test-token"})


def clear_auth_override() -> None:
    from app.core.auth import get_current_user
    from app.main import app

    app.dependency_overrides.pop(get_current_user, None)


SUPERADMIN_READ_ENDPOINTS: list[tuple[str, str]] = [
    ("GET", "/superadmin/sudo"),
    ("GET", "/superadmin/tenants"),
    ("GET", f"/superadmin/tenants/{TENANT_FREE}"),
    ("GET", f"/superadmin/tenants/{TENANT_FREE}/debrief-status"),
    ("GET", f"/superadmin/tenants/{TENANT_FREE}/quota-history"),
    ("GET", f"/superadmin/tenants/{TENANT_FREE}/data/summary"),
    ("GET", f"/superadmin/tenants/{TENANT_FREE}/data/preview"),
    ("GET", f"/superadmin/tenants/{TENANT_FREE}/data/export?table=sales_data"),
    ("GET", "/superadmin/users"),
    ("GET", f"/superadmin/tenants/{TENANT_FREE}/conversations"),
    ("GET", f"/superadmin/conversations/{CONVERSATION_ID}/messages"),
    ("GET", "/superadmin/feedback"),
    ("GET", f"/superadmin/billing/razorpay-status/{TENANT_FREE}"),
    ("GET", f"/superadmin/billing/stripe-status/{TENANT_FREE}"),
    ("GET", "/superadmin/revenue"),
    ("GET", "/superadmin/costs"),
    ("GET", "/superadmin/billing/webhooks/status"),
    ("GET", f"/superadmin/billing/timeline/{TENANT_FREE}"),
    ("GET", "/superadmin/security/communications"),
    ("GET", "/superadmin/audit-logs"),
    ("GET", "/superadmin/system/settings"),
    ("GET", "/superadmin/system/cron-health"),
    ("GET", "/superadmin/system/health"),
]

SUPERADMIN_WRITE_ENDPOINTS_NO_SUDO: list[tuple[str, str, dict[str, Any] | None]] = [
    ("PATCH", "/superadmin/system/settings", {"maintenance_mode": True, "reason": "Write without sudo gate test"}),
    ("PATCH", f"/superadmin/tenants/{TENANT_FREE}", {"name": "Renamed", "reason": "Write without sudo gate test"}),
    (
        "POST",
        f"/superadmin/billing/manual-upgrade/{TENANT_FREE}",
        {"plan": "pro", "reason": "Write without sudo gate test"},
    ),
    (
        "POST",
        f"/superadmin/impersonate/{TENANT_FREE}",
        {"reason": "Write without sudo gate test"},
    ),
    (
        "DELETE",
        f"/superadmin/tenants/{TENANT_FREE}/data",
        {"reason": "Write without sudo gate test", "confirm": "DELETE ALL DATA"},
    ),
]
