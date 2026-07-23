/**
 * CostDiagnostics — read-only superadmin view for billing validation.
 *
 * Lazy-loaded at /superadmin/costs.
 *
 * Shows all tenants with their current plan, effective limits,
 * copilot usage this month, estimated LLM cost, and retention cutoff.
 *
 * This is a temporary dev/validation view — it will be replaced by
 * the full Revenue tab in the superadmin build (later day).
 */

import { useEffect, useState } from "react";

import { RefreshCw } from "lucide-react";

import { AdminTable } from "@/components/admin/AdminTable";
import type { AdminTableColumn } from "@/components/admin/AdminTable";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types (mirrors superadmin cost endpoint — to be added in a later day)
// ---------------------------------------------------------------------------

interface TenantCostRow {
  tenant_id: string;
  tenant_name: string;
  plan: "free" | "pro" | "business";
  plan_status: string;
  copilot_calls_used: number;
  copilot_calls_limit: number;
  rows_used: number;
  rows_limit: number;
  cost_usd_this_month: number;
  retention_days: number;
  feature_overrides: Record<string, boolean>;
}

const PLAN_BADGE_CLASSES: Record<string, string> = {
  free:     "bg-neutral-100 text-neutral-700",
  pro:      "bg-violet-100 text-violet-700",
  business: "bg-amber-100 text-amber-800",
};

const STATUS_CLASSES: Record<string, string> = {
  active:    "text-emerald-400",
  trialing:  "text-violet-400",
  past_due:  "text-red-400 font-semibold",
  cancelled: "text-neutral-500",
};

function formatLimit(value: number): string {
  return value === -1 ? "∞" : value.toLocaleString("en-IN");
}

function RetentionCutoff({ days }: { days: number }) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return (
    <span className="text-sa-muted text-xs">
      {cutoff.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}
      <span className="ml-1 text-sa-muted/60">({days}d)</span>
    </span>
  );
}

const COLUMNS: AdminTableColumn<TenantCostRow>[] = [
  {
    key: "tenant_name",
    header: "Tenant",
    render: (row) => (
      <div>
        <div className="text-sa-text font-medium">{row.tenant_name}</div>
        <div className="text-sa-muted text-xs font-mono mt-0.5">{row.tenant_id.slice(0, 8)}…</div>
      </div>
    ),
  },
  {
    key: "plan",
    header: "Plan",
    render: (row) => (
      <div className="flex flex-col gap-1">
        <span
          className={cn(
            "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
            PLAN_BADGE_CLASSES[row.plan] ?? PLAN_BADGE_CLASSES.free
          )}
        >
          {row.plan}
        </span>
        <span className={cn("text-xs", STATUS_CLASSES[row.plan_status] ?? "text-sa-muted")}>
          {row.plan_status}
        </span>
      </div>
    ),
  },
  {
    key: "copilot_calls_used",
    header: "Copilot this month",
    render: (row) => (
      <span className="tabular-nums">
        {row.copilot_calls_used} / {formatLimit(row.copilot_calls_limit)}
      </span>
    ),
  },
  {
    key: "rows_used",
    header: "Rows stored",
    render: (row) => (
      <span className="tabular-nums">
        {row.rows_used.toLocaleString("en-IN")} / {formatLimit(row.rows_limit)}
      </span>
    ),
  },
  {
    key: "cost_usd_this_month",
    header: "LLM cost (mo.)",
    render: (row) => (
      <span className="tabular-nums font-mono">
        ${row.cost_usd_this_month.toFixed(4)}
      </span>
    ),
  },
  {
    key: "retention_days",
    header: "Data cutoff",
    render: (row) => <RetentionCutoff days={row.retention_days} />,
  },
  {
    key: "feature_overrides",
    header: "Overrides",
    render: (row) => {
      const keys = Object.keys(row.feature_overrides ?? {});
      if (keys.length === 0)
        return <span className="text-sa-muted text-xs">none</span>;
      return (
        <span className="text-xs text-amber-400 font-mono">
          {keys.join(", ")}
        </span>
      );
    },
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function CostDiagnostics() {
  const [rows, setRows] = useState<TenantCostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // This endpoint will be built properly in the superadmin Revenue tab day.
      // For now we fall back to an empty array so the page renders safely.
      const data = await apiFetch<TenantCostRow[]>("/superadmin/costs").catch(
        () => [] as TenantCostRow[]
      );
      setRows(data);
      setLastFetched(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-sa-text">Cost Diagnostics</h1>
          <p className="text-sm text-sa-muted mt-0.5">
            Temporary read-only view — validates billing infrastructure.
            {lastFetched && (
              <span className="ml-2 text-sa-muted/60">
                Last updated {lastFetched.toLocaleTimeString("en-IN")}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          aria-label="Refresh cost data"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm
            bg-sa-surface-2 text-sa-text hover:bg-sa-surface-3 disabled:opacity-50
            transition-colors border border-sa-border"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!error && rows.length === 0 && !loading && (
        <div className="rounded-lg border border-sa-border bg-sa-surface p-6 text-center text-sa-muted text-sm">
          No cost data yet — the{" "}
          <code className="font-mono text-xs">/superadmin/costs</code> endpoint
          will be built in the Revenue tab day.
        </div>
      )}

      <AdminTable
        columns={COLUMNS}
        data={rows}
        keyExtractor={(r) => r.tenant_id}
        loading={loading}
      />

      <p className="text-xs text-sa-muted">
        LLM costs are estimated from the model rate table in{" "}
        <code className="font-mono">llm_cost_logger.py</code>. Actual costs may
        vary by ±5% due to rounding.
      </p>
    </div>
  );
}
