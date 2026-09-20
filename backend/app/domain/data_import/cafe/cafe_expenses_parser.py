from __future__ import annotations

from app.domain.data_import.cafe.column_aliases import EXPENSE_ALIASES, EXPENSE_CATEGORY_MAP, norm


class CafeExpensesParser:
    def parse_row(self, raw: dict[str, object]) -> dict[str, object]:
        out: dict[str, object] = {}
        for key, value in raw.items():
            canonical = EXPENSE_ALIASES.get(norm(str(key)))
            if canonical:
                out[canonical] = value
        cat = out.get("category")
        if cat is not None:
            out["category"] = EXPENSE_CATEGORY_MAP.get(norm(str(cat)), "other")
        return out
