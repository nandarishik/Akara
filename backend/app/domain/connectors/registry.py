from __future__ import annotations

from app.domain.connectors.base import ConnectorBase


class ConnectorRegistry:
    _types = frozenset({"petpooja", "tally", "google_sheets", "urban_piper"})
    def get(self, connector_type: str) -> ConnectorBase:
        if connector_type not in self._types:
            raise KeyError(connector_type)
        return ConnectorBase()
