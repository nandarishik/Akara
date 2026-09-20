import type { SyncLogRow } from "../api/types";

type Props = {
  logs: SyncLogRow[];
  sourceName?: string;
};

export function SyncLogsTable({ logs }: Props) {
  if (logs.length === 0) {
    return <p className="text-sm text-text-muted">No sync runs yet.</p>;
  }

  return (
    <div className="overflow-x-auto" data-testid="sync-logs-table">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-text-muted">
            <th className="py-2 pr-3 font-medium">Started</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 pr-3 font-medium">Rows</th>
            <th className="py-2 pr-3 font-medium">Failed</th>
            <th className="py-2 font-medium">Message</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-border-subtle/60">
              <td className="py-2 pr-3 text-text-primary">
                {new Date(log.started_at).toLocaleString()}
              </td>
              <td className="py-2 pr-3 capitalize text-text-primary">{log.status}</td>
              <td className="py-2 pr-3 text-text-primary">{log.rows_synced}</td>
              <td className="py-2 pr-3 text-text-primary">{log.rows_failed}</td>
              <td className="py-2 text-text-muted">
                {/* Tenant UI: error_message only — never error_detail */}
                {log.error_message ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
