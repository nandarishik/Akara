from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class ConnectorStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    ERROR = "error"
    DISCONNECTED = "disconnected"

class ConnectorNetworkError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)

@dataclass
class SyncResult:
    status: str
    rows_synced: int = 0
    error_code: str | None = None
    error_message: str | None = None

class ConnectorBase:
    connector_type: str = ""
    async def test(self) -> SyncResult:
        return SyncResult(status="success")
    async def sync(self) -> SyncResult:
        return SyncResult(status="success", rows_synced=0)
