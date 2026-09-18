from __future__ import annotations

from app.domain.data_import.cafe.column_aliases import INVENTORY_ALIASES, norm


class CafeInventoryParser:
    def parse_row(self, raw: dict[str, object]) -> dict[str, object]:
        out: dict[str, object] = {}
        for key, value in raw.items():
            canonical = INVENTORY_ALIASES.get(norm(str(key)))
            if canonical:
                out[canonical] = value
        return out
