import { Link } from "react-router-dom";

import type { ConnectorSummary } from "../api/types";
import { customerErrorMessage } from "../api/errorMessages";
import { SecondaryButton } from "@/shared/ui/GradientButton";

const STATUS_LABEL: Record<ConnectorSummary["status"], string> = {
  active: "Active",
  error: "Error",
  disconnected: "Disconnected",
  pending: "Pending",
};

const STATUS_CLASS: Record<ConnectorSummary["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  error: "bg-red-500/15 text-red-700 dark:text-red-300",
  disconnected: "bg-stone-500/15 text-stone-600 dark:text-stone-300",
  pending: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
};

type Props = {
  connector: ConnectorSummary;
  onReconnect: (id: string) => void;
  onDisconnect: (id: string) => void;
};

function formatWhen(iso: string | null): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function ConnectorStatusCard({ connector, onReconnect, onDisconnect }: Props) {
  const err =
    connector.last_error ??
    (connector.status === "error"
      ? customerErrorMessage("SOURCE_UNREACHABLE", connector.source_name)
      : null);

  return (
    <article
      className="flex flex-col gap-3 border-b border-border-subtle py-5 last:border-0"
      data-testid="connector-status-card"
      data-status={connector.status}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium text-text-primary">{connector.source_name}</h3>
          <p className="mt-0.5 text-sm text-text-muted capitalize">
            {connector.connector_type.replaceAll("_", " ")}
          </p>
        </div>
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[connector.status]}`}
          data-testid="connector-status-badge"
        >
          {STATUS_LABEL[connector.status]}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-text-muted">Last sync</dt>
          <dd className="text-text-primary">{formatWhen(connector.last_sync_at)}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Rows last run</dt>
          <dd className="text-text-primary">{connector.rows_synced_last_run ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Next scheduled</dt>
          <dd className="text-text-primary">{formatWhen(connector.next_scheduled_sync)}</dd>
        </div>
      </dl>

      {err ? <p className="text-sm text-red-600 dark:text-red-400">{err}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Link
          to={`/connectors/${connector.id}`}
          className="inline-flex items-center rounded-md border border-border-subtle px-3 py-1.5 text-sm text-text-primary hover:bg-surface-elevated"
        >
          View Logs
        </Link>
        {(connector.status === "error" || connector.status === "disconnected") && (
          <SecondaryButton type="button" onClick={() => onReconnect(connector.id)}>
            Reconnect
          </SecondaryButton>
        )}
        {connector.status !== "disconnected" && (
          <SecondaryButton type="button" onClick={() => onDisconnect(connector.id)}>
            Disconnect
          </SecondaryButton>
        )}
      </div>
    </article>
  );
}
