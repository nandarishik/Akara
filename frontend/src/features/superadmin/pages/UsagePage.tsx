import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  sa,
  type AtRiskTenant,
  type TenantCostRow,
  type TenantRow,
} from "@/lib/api/superadmin";
import { MutationReasonField } from "@/features/superadmin/components/MutationReasonField";

type SortKey = "pct" | "name" | "usage" | "last_active";

function formatLimit(value: number): string {
  return value === -1 ? "âˆž" : value.toLocaleString("en-IN");
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN");
}

export function UsagePage() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [costRows, setCostRows] = useState<TenantCostRow[]>([]);
  const [atRisk, setAtRisk] = useState<{
    no_import_14d: AtRiskTenant[];
    no_login_14d: AtRiskTenant[];
    past_due: AtRiskTenant[];
  } | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("pct");
  const [tableSort, setTableSort] = useState<"last_active_at" | "name">("last_active_at");
  const [reason, setReason] = useState("Upsell nudge from superadmin usage panel");
  const [nudgeStatus, setNudgeStatus] = useState<Record<string, string>>({});
  const [activationStatus, setActivationStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    void sa.tenants({ limit: 200 }).then((r) => setTenants(r.items));
    void sa.tenantCostDiagnostics().then(setCostRows);
    void sa.atRiskTenants().then(setAtRisk);
  }, []);

  const upsellQueue = useMemo(() => {
    const queue = tenants
      .map((t) => {
        const limit = t.copilot_limit;
        if (limit < 0) return null;
        const pct = limit > 0 ? Math.round((t.copilot_calls_this_month / limit) * 100) : 0;
        return { ...t, pct, limit };
      })
      .filter((x): x is TenantRow & { pct: number; limit: number } => x !== null && x.pct >= 70);

    queue.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "usage") return b.copilot_calls_this_month - a.copilot_calls_this_month;
      return b.pct - a.pct;
    });
    return queue;
  }, [tenants, sortBy]);

  const atRiskQueue = useMemo(() => {
    if (!atRisk) return [];
    const seen = new Set<string>();
    const merged: AtRiskTenant[] = [];
    for (const list of [atRisk.past_due, atRisk.no_import_14d, atRisk.no_login_14d]) {
      for (const t of list) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          merged.push(t);
        }
      }
    }
    return merged;
  }, [atRisk]);

  const usageTable = useMemo(() => {
    const rows = [...tenants];
    rows.sort((a, b) => {
      if (tableSort === "name") return a.name.localeCompare(b.name);
      const aTs = a.last_active_at ? new Date(a.last_active_at).getTime() : 0;
      const bTs = b.last_active_at ? new Date(b.last_active_at).getTime() : 0;
      return bTs - aTs;
    });
    return rows;
  }, [tenants, tableSort]);

  const reasonOk = reason.trim().length >= 10;

  async function handleNudge(tenantId: string) {
    if (!reasonOk) return;
    setNudgeStatus((s) => ({ ...s, [tenantId]: "Sendingâ€¦" }));
    try {
      await sa.nudgeUpgrade(tenantId, reason.trim());
      setNudgeStatus((s) => ({ ...s, [tenantId]: "Sent" }));
    } catch (e) {
      setNudgeStatus((s) => ({
        ...s,
        [tenantId]: e instanceof Error ? e.message : "Failed",
      }));
    }
  }

  async function handleActivationNudge(tenantId: string, template: "day1_no_import" | "day3_no_copilot" | "day7_no_phone") {
    if (!reasonOk) return;
    setActivationStatus((s) => ({ ...s, [tenantId]: "Sendingâ€¦" }));
    try {
      await sa.activationNudge(tenantId, reason.trim(), template);
      setActivationStatus((s) => ({ ...s, [tenantId]: "Sent" }));
    } catch (e) {
      setActivationStatus((s) => ({
        ...s,
        [tenantId]: e instanceof Error ? e.message : "Failed",
      }));
    }
  }

  function activationTemplate(reason: string): "day1_no_import" | "day3_no_copilot" | "day7_no_phone" {
    if (reason === "no_login_14d") return "day3_no_copilot";
    if (reason === "past_due") return "day7_no_phone";
    return "day1_no_import";
  }

  return (
    <div className="space-y-6 text-sa-text max-w-5xl">
      <h2 className="text-xl font-semibold">Usage &amp; queues</h2>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
          <h3 className="text-sm font-medium text-sa-muted">Upsell queue (â‰¥70% copilot quota)</h3>
          <div className="flex items-end gap-3">
            <div>
              <label className="text-xs text-sa-muted">Sort by</label>
              <select
                className="mt-1 block rounded border border-sa-border bg-sa-raised px-2 py-1 text-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
              >
                <option value="pct">Usage %</option>
                <option value="usage">Absolute usage</option>
                <option value="name">Tenant name</option>
              </select>
            </div>
            <div className="w-64">
              <MutationReasonField value={reason} onChange={setReason} />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-sa-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sa-raised text-left text-xs text-sa-muted">
              <tr>
                <th className="p-3">Tenant</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Usage (mo)</th>
                <th className="p-3">Today</th>
                <th className="p-3 w-28">Nudge</th>
              </tr>
            </thead>
            <tbody>
              {upsellQueue.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-sa-border cursor-pointer hover:bg-white/5"
                  onClick={() => navigate(`/superadmin/tenants?open=${t.id}`)}
                >
                  <td className="p-3">{t.name}</td>
                  <td className="p-3 capitalize">{t.plan}</td>
                  <td className="p-3 tabular-nums">
                    {t.copilot_calls_this_month}/{t.limit} ({t.pct}%)
                  </td>
                  <td className="p-3 tabular-nums">
                    {t.questions_today}/{formatLimit(t.copilot_limit)}
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      className="text-xs text-sa-accent underline disabled:opacity-40"
                      disabled={!reasonOk}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleNudge(t.id);
                      }}
                    >
                      {nudgeStatus[t.id] || "Nudge"}
                    </button>
                  </td>
                </tr>
              ))}
              {upsellQueue.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-sa-muted">No tenants near quota</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
          <h3 className="text-sm font-medium text-sa-muted">At-risk queue</h3>
          <div className="w-64">
            <MutationReasonField value={reason} onChange={setReason} />
          </div>
        </div>
        <div className="rounded-lg border border-sa-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sa-raised text-left text-xs text-sa-muted">
              <tr>
                <th className="p-3">Tenant</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Last active</th>
                <th className="p-3 w-32">Activation nudge</th>
              </tr>
            </thead>
            <tbody>
              {atRiskQueue.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-sa-border cursor-pointer hover:bg-white/5"
                  onClick={() => navigate(`/superadmin/tenants?open=${t.id}`)}
                >
                  <td className="p-3">{t.name}</td>
                  <td className="p-3 capitalize text-xs">{t.reason.replace(/_/g, " ")}</td>
                  <td className="p-3 text-xs text-sa-muted">{formatRelative(t.last_active_at)}</td>
                  <td className="p-3">
                    <button
                      type="button"
                      className="text-xs text-sa-accent underline disabled:opacity-40"
                      disabled={!reasonOk}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleActivationNudge(t.id, activationTemplate(t.reason));
                      }}
                    >
                      {activationStatus[t.id] || "Nudge"}
                    </button>
                  </td>
                </tr>
              ))}
              {atRiskQueue.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-sa-muted">No at-risk tenants</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-medium text-sa-muted">All tenants â€” usage</h3>
          <select
            className="rounded border border-sa-border bg-sa-raised px-2 py-1 text-xs"
            value={tableSort}
            onChange={(e) => setTableSort(e.target.value as "last_active_at" | "name")}
          >
            <option value="last_active_at">Sort by last active</option>
            <option value="name">Sort by name</option>
          </select>
        </div>
        <div className="rounded-lg border border-sa-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sa-raised text-left text-xs text-sa-muted">
              <tr>
                <th className="p-3">Tenant</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Questions today</th>
                <th className="p-3">Copilot (mo)</th>
                <th className="p-3">Last active</th>
              </tr>
            </thead>
            <tbody>
              {usageTable.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-sa-border cursor-pointer hover:bg-white/5"
                  onClick={() => navigate(`/superadmin/tenants?open=${t.id}`)}
                >
                  <td className="p-3">{t.name}</td>
                  <td className="p-3 capitalize">{t.plan}</td>
                  <td className="p-3 tabular-nums">
                    {t.questions_today}/{formatLimit(t.copilot_limit)}
                  </td>
                  <td className="p-3 tabular-nums">
                    {t.copilot_calls_this_month}/{formatLimit(t.copilot_limit)}
                  </td>
                  <td className="p-3 text-xs text-sa-muted">{formatRelative(t.last_active_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-sa-muted mb-2">Cost diagnostics (all tenants)</h3>
        <div className="rounded-lg border border-sa-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sa-raised text-left text-xs text-sa-muted">
              <tr>
                <th className="p-3">Tenant</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Copilot</th>
                <th className="p-3">Rows</th>
                <th className="p-3">Cost (USD)</th>
              </tr>
            </thead>
            <tbody>
              {costRows.map((r) => (
                <tr
                  key={r.tenant_id}
                  className="border-t border-sa-border cursor-pointer hover:bg-white/5"
                  onClick={() => navigate(`/superadmin/tenants?open=${r.tenant_id}`)}
                >
                  <td className="p-3">
                    <p>{r.tenant_name}</p>
                    <p className="text-xs text-sa-muted font-mono">{r.tenant_id.slice(0, 8)}â€¦</p>
                  </td>
                  <td className="p-3 capitalize">{r.plan}</td>
                  <td className="p-3 tabular-nums">
                    {r.copilot_calls_used} / {formatLimit(r.copilot_calls_limit)}
                  </td>
                  <td className="p-3 tabular-nums">
                    {r.rows_used.toLocaleString("en-IN")} / {formatLimit(r.rows_limit)}
                  </td>
                  <td className="p-3 tabular-nums">${r.cost_usd_this_month.toFixed(4)}</td>
                </tr>
              ))}
              {costRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-sa-muted">Loading cost dataâ€¦</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
