from __future__ import annotations

from app.domain.data_import.cafe.column_aliases import CHANNEL_VALUE_MAP, CANONICAL_ORDER_ALIASES, norm


class CafeOrdersParser:
    aliases = CANONICAL_ORDER_ALIASES

    def parse_row(self, raw: dict[str, object]) -> dict[str, object]:
        out: dict[str, object] = {}
        for key, value in raw.items():
            canonical = self.aliases.get(norm(str(key)))
            if canonical:
                out[canonical] = value
        channel = out.get("channel")
        if channel is not None:
            out["channel"] = CHANNEL_VALUE_MAP.get(norm(str(channel)), "other")
        return out
