import { useCallback, useEffect, useState } from "react";

import { DangerousActionDialog } from "@/features/superadmin/components/DangerousActionDialog";
import {
  endImpersonationSession,
  listActiveImpersonations,
  type ImpersonationSessionRow,
} from "@/lib/api/superadmin";
import { Button } from "@/shared/ui/button";

export function ImpersonationPage() {
  const [items, setItems] = useState<ImpersonationSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<ImpersonationSessionRow | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listActiveImpersonations();
      setItems(res.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sessions");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRevoke(reason: string) {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await endImpersonationSession(revokeTarget.id, reason);
      setRevokeTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-sa-text">Active impersonations</h1>
          <p className="mt-1 text-sm text-sa-muted">
            Revoke live support sessions. Requires a reason (min 10 characters).
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          className="border-sa-border text-sa-text"
        >
          Refresh
        </Button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sa-accent border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-sa-border bg-sa-raised px-4 py-6 text-sm text-sa-muted">
          No active impersonation sessions.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-sa-border">
          <table className="w-full text-left text-sm text-sa-text">
            <thead className="border-b border-sa-border bg-sa-raised text-xs uppercase tracking-wide text-sa-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Tenant</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">Expires</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-sa-border/60">
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.tenant_name ?? row.tenant_id}</div>
                    <div className="font-mono text-[10px] text-sa-muted">{row.tenant_id}</div>
                  </td>
                  <td className="max-w-xs truncate px-3 py-2 text-sa-muted">{row.reason}</td>
                  <td className="px-3 py-2 text-xs text-sa-muted">
                    {new Date(row.started_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs text-sa-muted">
                    {new Date(row.expires_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setRevokeTarget(row)}
                    >
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DangerousActionDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke impersonation session"
        summary={
          revokeTarget
            ? `End the active impersonation of ${revokeTarget.tenant_name ?? revokeTarget.tenant_id}. The operator will lose tenant access immediately.`
            : ""
        }
        minReasonLength={10}
        loading={revoking}
        onConfirm={handleRevoke}
      />
    </div>
  );
}
