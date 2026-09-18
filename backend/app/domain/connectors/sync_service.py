from __future__ import annotations
from uuid import UUID
from app.domain.connectors.base import SyncResult
from app.domain.connectors.registry import ConnectorRegistry

class SyncService:
    def __init__(self) -> None:
        self.registry = ConnectorRegistry()
    async def run(self, connector_type: str, connector_id: UUID) -> SyncResult:
        connector = self.registry.get(connector_type)
        return await connector.sync()
