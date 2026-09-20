/** Frozen wire types for `/api/v1/connectors` (snake_case). */

export type ConnectorType = "petpooja" | "tally" | "google_sheets" | "urban_piper";

export type ConnectorStatus = "pending" | "active" | "error" | "disconnected";

export type SyncStatus = "success" | "partial" | "failed";

export type LogStatus = "running" | "success" | "partial" | "failed";

export type ConnectorErrorCode =
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "SOURCE_UNREACHABLE"
  | "NO_DATA"
  | "SCHEMA_MISMATCH"
  | "QUOTA_EXCEEDED"
  | "CONNECTORS_DISABLED"
  | "GATED";

export type ConnectorSummary = {
  id: string;
  connector_type: ConnectorType;
  source_name: string;
  status: ConnectorStatus;
  last_sync_at: string | null;
  last_sync_status: SyncStatus | null;
  rows_synced_last_run: number | null;
  last_error: string | null;
  next_scheduled_sync: string | null;
};

export type ConnectorListResponse = {
  connectors: ConnectorSummary[];
};

export type SyncLogRow = {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: LogStatus;
  rows_synced: number;
  rows_failed: number;
  error_code: ConnectorErrorCode | null;
  error_message: string | null;
  duration_ms?: number | null;
};

export type ConnectorDetail = ConnectorSummary & {
  config: Record<string, unknown>;
  logs: SyncLogRow[];
  /** Shown once on tally create only — never persisted in UI state long-term. */
  connector_api_key?: string;
  key_prefix?: string;
};

export type CreateConnectorBody = {
  connector_type: ConnectorType;
  source_name: string;
  credentials?: Record<string, string>;
  config?: Record<string, unknown>;
};

export type PatchConnectorBody = {
  source_name?: string;
  config?: Record<string, unknown>;
};

export type TestConnectionResponse = {
  connected: boolean;
  message: string;
  details?: Record<string, unknown>;
};

export type SyncAcceptedResponse = {
  job_id: string;
  status: "accepted";
};

export type LogsResponse = {
  logs: SyncLogRow[];
  next_cursor: string | null;
};

export type SystemSettingsConnectors = {
  maintenance_mode: boolean;
  signup_open: boolean;
  environment_banner?: string | null;
  connectors_enabled?: boolean;
};
