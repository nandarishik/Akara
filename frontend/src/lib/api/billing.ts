/**
 * Billing API client — typed wrapper for GET /billing/usage.
 *
 * All quota limits come from the backend; never hardcode them in the UI.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export interface UsageResponse {
  plan: "free" | "pro" | "business";
  plan_status: "active" | "trialing" | "past_due" | "cancelled";

  // Monthly copilot quota (-1 = unlimited)
  copilot_calls_used: number;
  copilot_calls_limit: number;

  // Row storage (-1 = unlimited)
  rows_used: number;
  rows_limit: number;

  // Monthly uploads (-1 = unlimited for pro/business)
  uploads_used: number;
  uploads_limit: number;

  // Daily upload cap (always 3, all plans)
  uploads_today: number;
  uploads_per_day: number;

  // Daily undo cap (always 2, all plans)
  undos_today: number;
  undos_per_day: number;

  // User seats
  users_used: number;
  users_limit: number;

  // Feature flags (plan + per-tenant overrides applied by backend)
  features: {
    morning_brief: boolean;
    scheme_leakage: boolean;
    simulator: boolean;
    reports: boolean;
    custom_language: boolean;
    secondary_sales: boolean;
    api_push: boolean;
    tally_connector: boolean;
    team_invites: boolean;
    api_keys: boolean;
    ask_copilot_debrief: boolean;
  };

  // Retention
  retention_days: number;
}

export async function fetchBillingUsage(
  authToken: string
): Promise<UsageResponse> {
  const res = await fetch(`${API_BASE}/billing/usage`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET /billing/usage failed [${res.status}]: ${body}`);
  }

  return res.json() as Promise<UsageResponse>;
}

// ---------------------------------------------------------------------------
// Quota helper utilities — consumed by UsageBanner
// ---------------------------------------------------------------------------

export type QuotaLevel = "ok" | "warning" | "critical" | "blocked";

/** Returns the quota level for a used/limit pair. */
export function getQuotaLevel(used: number, limit: number): QuotaLevel {
  if (limit === -1) return "ok"; // unlimited
  if (limit === 0) return "blocked";
  const pct = used / limit;
  if (pct >= 1) return "blocked";
  if (pct >= 0.9) return "critical";
  if (pct >= 0.8) return "warning";
  return "ok";
}

/** Returns used / limit as a 0–100 percentage (capped at 100). */
export function getUsagePct(used: number, limit: number): number {
  if (limit === -1 || limit === 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

/** Returns the first day of next month as a human-readable string. */
export function getMonthResetDate(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
