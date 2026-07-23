"""Bounded pagination contracts for AKARA Phase 2.

All list endpoints must use one of these two schemes:
 - OffsetPagination  (for small, non-real-time lists)
 - CursorPagination  (for time-ordered infinite scroll / large sets)

Usage:
    @router.get("/items")
    def list_items(params: OffsetParams = Depends()) -> OffsetPage[ItemOut]:
        ...
"""

from __future__ import annotations

from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel

T = TypeVar("T")

MAX_PAGE_SIZE = 200
DEFAULT_PAGE_SIZE = 50


# ---------------------------------------------------------------------------
# Offset pagination
# ---------------------------------------------------------------------------

class OffsetParams:
    """FastAPI dependency — inject with `Depends()`."""

    def __init__(
        self,
        page: int = Query(default=1, ge=1, description="1-based page number"),
        page_size: int = Query(
            default=DEFAULT_PAGE_SIZE,
            ge=1,
            le=MAX_PAGE_SIZE,
            description=f"Items per page (max {MAX_PAGE_SIZE})",
        ),
    ) -> None:
        self.page = page
        self.page_size = page_size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


class OffsetPage(BaseModel, Generic[T]):  # noqa: UP046
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int

    @classmethod
    def build(cls, items: list[T], total: int, params: OffsetParams) -> OffsetPage[T]:
        total_pages = max(1, (total + params.page_size - 1) // params.page_size)
        return cls(
            items=items,
            total=total,
            page=params.page,
            page_size=params.page_size,
            total_pages=total_pages,
        )


# ---------------------------------------------------------------------------
# Cursor pagination (opaque string cursor, typically ISO timestamp or UUID)
# ---------------------------------------------------------------------------

class CursorParams:
    """FastAPI dependency — inject with `Depends()`."""

    def __init__(
        self,
        cursor: str | None = Query(
            default=None,
            description="Opaque cursor from previous page's next_cursor",
        ),
        limit: int = Query(
            default=DEFAULT_PAGE_SIZE,
            ge=1,
            le=MAX_PAGE_SIZE,
        ),
    ) -> None:
        self.cursor = cursor
        self.limit = limit


class CursorPage(BaseModel, Generic[T]):  # noqa: UP046
    items: list[T]
    next_cursor: str | None
    has_more: bool

    @classmethod
    def build(
        cls, items: list[T], limit: int, cursor_fn: callable[[T], str]
    ) -> CursorPage[T]:
        """Build a cursor page.
        Fetches `limit + 1` rows; if we got an extra row there are more results.
        `cursor_fn` extracts the cursor value from the last real item.
        """
        has_more = len(items) > limit
        page_items = items[:limit]
        next_cursor = cursor_fn(page_items[-1]) if has_more and page_items else None
        return cls(items=page_items, next_cursor=next_cursor, has_more=has_more)
