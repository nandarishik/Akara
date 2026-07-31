import { supabase } from "@/lib/supabase";

const BASE = import.meta.env.VITE_API_BASE_URL as string;

function csrfFromCookie(): string {
  const match = document.cookie.match(/(?:^|;\s*)akara_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function superadminFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const method = (options.method || "GET").toUpperCase();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(options.headers as Record<string, string> | undefined),
  };
  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    const csrf = csrfFromCookie();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface SudoStatus {
  active: boolean;
  expires_at: string | null;
}

export async function getSudoStatus(): Promise<SudoStatus> {
  return superadminFetch<SudoStatus>("/superadmin/sudo");
}

export async function startSudo(password: string): Promise<{ expires_at: string; csrf_token: string }> {
  return superadminFetch("/superadmin/sudo", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function checkSuperadminAccess(): Promise<boolean> {
  try {
    await getSudoStatus();
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("404")) return false;
    throw e;
  }
}

export interface RevenueSummary {
  mrr_inr: number;
  arr_inr: number;
  tenants_by_plan: Record<string, number>;
  total_active_tenants?: number;
  new_paid_this_month: number;
  churned_this_month: number;
  total_llm_cost_usd_this_month: number;
  estimated_gross_margin_pct: number;
  mrr_mom_pct?: number | null;
  margin_delta_pp?: number | null;
  active_tenants_delta?: number | null;
}

export interface CostsSummary {
  total_cost_usd_this_month: number;
  cost_by_feature: Record<string, number>;
  cost_by_tenant: { tenant_id: string; cost_usd: number }[];
  avg_cost_per_question: number;
}

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  plan_status: string;
  is_active: boolean;
  user_count: number;
  copilot_calls_this_month: number;
  copilot_limit: number;
  questions_today: number;
  rows_stored: number;
  last_import_at: string | null;
  last_active_at: string | null;
  internal_notes: string;
  created_at?: string | null;
  feature_overrides?: Record<string, boolean>;
  trial_ends_at?: string | null;
}

export interface OverviewStats {
  questions_today: number;
  new_this_week: {
    signups: number;
    upgrades: number;
    churns: number;
  };
}

export interface AtRiskTenant {
  id: string;
  name: string;
  plan: string;
  plan_status: string;
  is_active: boolean;
  last_import_at: string | null;
  last_active_at: string | null;
  reason: string;
}

export interface AtRiskResponse {
  no_import_14d: AtRiskTenant[];
  no_login_14d: AtRiskTenant[];
  past_due: AtRiskTenant[];
}

export interface RecentPaymentRow {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  invoice_number: string | null;
  amount_inr: number;
  status: string;
  created_at: string;
}

export interface UserRow {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string;
  tenant_id: string | null;
  tenant_name: string | null;
  plan: string | null;
  last_sign_in_at: string | null;
  created_at: string | null;
}

export interface AuditLogRow {
  id: string;
  action: string;
  actor_email: string | null;
  created_at: string;
  tenant_id?: string | null;
  ip_address?: string | null;
  details: Record<string, unknown> | null;
}

export interface AuditFilters {
  limit?: number;
  offset?: number;
  tenant_id?: string;
  action?: string;
  date_from?: string;
  date_to?: string;
  ip?: string;
}

export interface BroadcastHistoryRow {
  id: string;
  subject: string;
  channels: string[];
  tenant_count: number;
  sent_count: number;
  plan_filter?: string | null;
  status_filter?: string | null;
  body_html?: string | null;
  whatsapp_body?: string | null;
  scheduled_at?: string | null;
  status?: string;
  created_at: string;
}

export interface RevenueSnapshotRow {
  snapshot_date: string;
  mrr_inr: number;
  arr_inr: number;
  tenant_count: number;
  llm_cost_usd: number;
}

export interface TenantOpsDetail {
  tenant_id: string;
  imports_this_month: number;
  imports_limit: number;
  margin_pct: number | null;
  llm_cost_usd_this_month: number;
  delivery_events: Array<{ action: string; created_at: string; details: Record<string, unknown> }>;
}

export interface TenantCostRow {
  tenant_id: string;
  tenant_name: string;
  plan: string;
  plan_status: string;
  copilot_calls_used: number;
  copilot_calls_limit: number;
  rows_used: number;
  rows_limit: number;
  cost_usd_this_month: number;
  retention_days: number;
  feature_overrides: Record<string, boolean>;
}

export interface ActivityRow {
  id: string;
  action: string;
  created_at: string;
  tenant_id?: string | null;
  tenant_name?: string | null;
  tenant_plan?: string | null;
  actor_email?: string | null;
  highlight?: boolean;
}

export interface FounderBriefRow {
  id: string;
  brief_text: string;
  generated_at: string;
  delivery_status: string;
}

export interface PlanLimitsCatalog {
  plans: Record<string, Record<string, unknown>>;
}

export interface TenantDebriefStatus {
  tenant_id: string;
  last_debrief_at: string | null;
  debrief_count: number;
  last_email_status: string | null;
  last_whatsapp_status: string | null;
}

export interface ConversationMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
  cost_usd?: number | null;
}

export interface DataSummary {
  row_count: number;
  oldest_record_date: string | null;
  newest_record_date: string | null;
  distinct_parties: number;
  distinct_routes: number;
  distinct_zones: number;
  total_revenue: number;
  last_import_at: string | null;
}

type MutationBody = Record<string, unknown> & { reason: string; dry_run?: boolean };

function auditQuery(filters: AuditFilters = {}): string {
  const p = new URLSearchParams();
  if (filters.limit != null) p.set("limit", String(filters.limit));
  if (filters.offset != null) p.set("offset", String(filters.offset));
  if (filters.tenant_id) p.set("tenant_id", filters.tenant_id);
  if (filters.action) p.set("action", filters.action);
  if (filters.date_from) p.set("date_from", filters.date_from);
  if (filters.date_to) p.set("date_to", filters.date_to);
  if (filters.ip) p.set("ip", filters.ip);
  return p.toString();
}

export const sa = {
  revenue: () => superadminFetch<RevenueSummary>("/superadmin/revenue"),
  revenueSnapshots: (months = 6) =>
    superadminFetch<{ items: RevenueSnapshotRow[]; total: number }>(
      `/superadmin/revenue/snapshots?months=${months}`,
    ),
  costs: () => superadminFetch<CostsSummary>("/superadmin/costs"),
  tenantCostDiagnostics: () => superadminFetch<TenantCostRow[]>("/superadmin/costs/tenants"),
  planLimits: () => superadminFetch<PlanLimitsCatalog>("/superadmin/plan-limits"),
  overviewActivity: (limit = 20) =>
    superadminFetch<{ items: ActivityRow[]; total: number }>(
      `/superadmin/overview/activity?limit=${limit}`,
    ),
  overviewStats: () => superadminFetch<OverviewStats>("/superadmin/overview/stats"),
  recentPayments: (limit = 10) =>
    superadminFetch<{ items: RecentPaymentRow[]; total: number }>(
      `/superadmin/billing/recent-payments?limit=${limit}`,
    ),
  atRiskTenants: () => superadminFetch<AtRiskResponse>("/superadmin/usage/at-risk"),

  tenants: (opts: { limit?: number; search?: string; plan?: string; plan_status?: string } = {}) => {
    const p = new URLSearchParams({ limit: String(opts.limit ?? 100) });
    if (opts.search) p.set("search", opts.search);
    if (opts.plan) p.set("plan", opts.plan);
    if (opts.plan_status) p.set("plan_status", opts.plan_status);
    return superadminFetch<{ items: TenantRow[]; total: number }>(`/superadmin/tenants?${p}`);
  },
  getTenant: (id: string) => superadminFetch<TenantRow>(`/superadmin/tenants/${id}`),
  tenantOpsDetail: (id: string) =>
    superadminFetch<TenantOpsDetail>(`/superadmin/tenants/${id}/ops-detail`),
  resendInvoice: (id: string, reason: string) =>
    superadminFetch<{ status: string; invoice_number: string }>(
      `/superadmin/billing/resend-invoice/${id}`,
      { method: "POST", body: JSON.stringify({ reason }) },
    ),
  createTenant: (body: MutationBody & { name: string; slug: string; plan?: string }) =>
    superadminFetch<{ ok: boolean; tenant: { id: string } }>("/superadmin/tenants", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  patchTenant: (id: string, body: MutationBody & { name?: string; slug?: string }) =>
    superadminFetch(`/superadmin/tenants/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  patchPlan: (id: string, body: MutationBody & { plan?: string; plan_status?: string; trial_ends_at?: string }) =>
    superadminFetch(`/superadmin/tenants/${id}/plan`, { method: "PATCH", body: JSON.stringify(body) }),
  assignPlan: (
    id: string,
    body: MutationBody & {
      plan_code: string;
      custom_limits?: Record<string, unknown>;
      custom_price_minor?: number | null;
      source?: string;
      notes?: string;
      contract_metadata?: Record<string, unknown>;
    },
  ) =>
    superadminFetch(`/superadmin/tenants/${id}/plan-assignment`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  patchFeatures: (id: string, body: MutationBody & { features: Record<string, boolean> }) =>
    superadminFetch(`/superadmin/tenants/${id}/features`, { method: "PATCH", body: JSON.stringify(body) }),
  patchQuota: (id: string, body: MutationBody & Record<string, unknown>) =>
    superadminFetch(`/superadmin/tenants/${id}/quota`, { method: "PATCH", body: JSON.stringify(body) }),
  activateTenant: (id: string, reason: string) =>
    superadminFetch(`/superadmin/tenants/${id}/activate`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
  deactivateTenant: (id: string, reason: string) =>
    superadminFetch(`/superadmin/tenants/${id}/deactivate`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
  wipeTenantData: (id: string, body: MutationBody) =>
    superadminFetch(`/superadmin/tenants/${id}/data${body.dry_run ? "" : "?confirm=true"}`, {
      method: "DELETE",
      body: JSON.stringify(body),
    }),
  deleteTenant: (id: string, body: MutationBody & { confirm: string }) =>
    superadminFetch(`/superadmin/tenants/${id}`, { method: "DELETE", body: JSON.stringify(body) }),
  quotaHistory: (id: string) =>
    superadminFetch<Array<{ month: string; copilot_calls: number }>>(
      `/superadmin/tenants/${id}/quota-history`,
    ),
  billingTimeline: (id: string) =>
    superadminFetch<{ tenant_id: string; events: Record<string, unknown>[] }>(
      `/superadmin/billing/timeline/${id}`,
    ),
  razorpayStatus: (id: string) =>
    superadminFetch<Record<string, unknown>>(`/superadmin/billing/razorpay-status/${id}`),
  conversations: (id: string) =>
    superadminFetch<
      Array<{ id: string; title: string; updated_at: string; last_message_at?: string | null }>
    >(`/superadmin/tenants/${id}/conversations`),
  conversationMessages: (conversationId: string) =>
    superadminFetch<ConversationMessage[]>(
      `/superadmin/conversations/${conversationId}/messages`,
    ),
  debriefStatus: (id: string) =>
    superadminFetch<TenantDebriefStatus>(`/superadmin/tenants/${id}/debrief-status`),
  dataSummary: (id: string) => superadminFetch<DataSummary>(`/superadmin/tenants/${id}/data/summary`),
  dataPreview: (id: string) =>
    superadminFetch<{ rows: Record<string, unknown>[] }>(
      `/superadmin/tenants/${id}/data/preview`,
    ),
  manualUpgrade: (
    id: string,
    body: MutationBody & { plan: string; clear_past_due?: boolean },
  ) =>
    superadminFetch(`/superadmin/billing/manual-upgrade/${id}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  extendTrial: (id: string, body: MutationBody & { days: number }) =>
    superadminFetch(`/superadmin/billing/extend-trial/${id}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  nudgeUpgrade: (id: string, reason: string) =>
    superadminFetch(`/superadmin/tenants/${id}/nudge-upgrade`, {
      method: "POST",
      body: JSON.stringify({ reason, channel: "email" }),
    }),
  activationNudge: (
    id: string,
    reason: string,
    template: "day1_no_import" | "day3_no_copilot" | "day7_no_phone" = "day1_no_import",
  ) =>
    superadminFetch(`/superadmin/tenants/${id}/activation-nudge`, {
      method: "POST",
      body: JSON.stringify({ reason, template }),
    }),
  patchTenantNotes: (tenantId: string, notes: string, reason: string) =>
    superadminFetch(`/superadmin/tenants/${tenantId}/notes`, {
      method: "PATCH",
      body: JSON.stringify({ internal_notes: notes, reason }),
    }),
  impersonate: (tenantId: string, reason: string) =>
    superadminFetch<{ magic_link?: string }>(`/superadmin/impersonate/${tenantId}`, {
      method: "POST",
      body: JSON.stringify({ reason, dry_run: false }),
    }),

  users: (opts: { limit?: number; search?: string; tenant_id?: string } = {}) => {
    const p = new URLSearchParams({ limit: String(opts.limit ?? 100) });
    if (opts.search) p.set("search", opts.search);
    if (opts.tenant_id) p.set("tenant_id", opts.tenant_id);
    return superadminFetch<{ items: UserRow[]; total: number }>(
      `/superadmin/users?${p}`,
    );
  },
  suspendUser: (id: string, reason: string) =>
    superadminFetch(`/superadmin/users/${id}/suspend`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
  activateUser: (id: string, reason: string) =>
    superadminFetch(`/superadmin/users/${id}/activate`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),
  resetPassword: (id: string, reason: string) =>
    superadminFetch(`/superadmin/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  magicLink: (id: string, reason: string) =>
    superadminFetch<{ magic_link?: string }>(`/superadmin/users/${id}/magic-link`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  deleteUser: (id: string, reason: string) =>
    superadminFetch(`/superadmin/users/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    }),
  moveUserTenant: (id: string, tenantId: string, reason: string) =>
    superadminFetch(`/superadmin/users/${id}/tenant`, {
      method: "PATCH",
      body: JSON.stringify({ tenant_id: tenantId, reason }),
    }),

  auditLogs: (filters: AuditFilters = {}) =>
    superadminFetch<{ items: AuditLogRow[]; total: number }>(
      `/superadmin/audit-logs?${auditQuery({ limit: 50, ...filters })}`,
    ),
  broadcastHistory: (limit = 50, offset = 0) =>
    superadminFetch<{ items: BroadcastHistoryRow[]; total: number }>(
      `/superadmin/reports/broadcast-history?limit=${limit}&offset=${offset}`,
    ),
  broadcast: (payload: Record<string, unknown>) =>
    superadminFetch("/superadmin/reports/broadcast", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  cancelBroadcast: (historyId: string, reason: string) =>
    superadminFetch(`/superadmin/reports/broadcast/${historyId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  cronHealth: () =>
    superadminFetch<{
      tasks: Array<{
        task_name: string;
        status: string | null;
        last_run?: string | null;
        details?: Record<string, unknown>;
      }>;
    }>("/superadmin/system/cron-health"),
  cronLogs: (taskName: string, limit = 20) =>
    superadminFetch<{ items: Array<Record<string, unknown>>; total: number }>(
      `/superadmin/system/cron-logs/${taskName}?limit=${limit}`,
    ),
  systemHealth: () => superadminFetch<Record<string, unknown>>("/superadmin/system/health"),
  runCron: (taskName: string, reason: string) =>
    superadminFetch(`/superadmin/system/cron-run/${taskName}`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  copilotChips: () => superadminFetch<{ chips: string[] }>("/superadmin/copilot/chips"),
  runFounderBrief: () =>
    superadminFetch<{ text: string }>("/superadmin/copilot/founder-brief/run", { method: "POST" }),
  founderBriefHistory: (limit = 10) =>
    superadminFetch<{ items: FounderBriefRow[]; total: number }>(
      `/superadmin/copilot/founder-brief/history?limit=${limit}`,
    ),
};
