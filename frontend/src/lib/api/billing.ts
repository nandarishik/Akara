/**
 * Billing API client — usage, checkout, subscription, GST details, invoices.
 */

import { apiFetch } from "@/lib/api";

export interface UsageResponse {
  plan: "free" | "pro" | "business";
  plan_status: "active" | "trialing" | "past_due" | "cancelled";
  copilot_calls_used: number;
  copilot_calls_limit: number;
  rows_used: number;
  rows_limit: number;
  uploads_used: number;
  uploads_limit: number;
  uploads_today: number;
  uploads_per_day: number;
  undos_today: number;
  undos_per_day: number;
  users_used: number;
  users_limit: number;
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
    alerts: boolean;
  };
  retention_days: number;
}

export interface BillingDetails {
  gstin?: string;
  company_name?: string;
  billing_address?: string;
  billing_state?: string;
}

export interface InvoiceSummary {
  id: string;
  invoice_number: string;
  total_amount: number;
  tax_type: string;
  status: string;
  created_at: string;
  pdf_storage_path?: string | null;
}

export async function fetchBillingUsage(authToken: string): Promise<UsageResponse> {
  const API_BASE = import.meta.env.VITE_API_BASE_URL as string;
  const res = await fetch(`${API_BASE}/billing/usage`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`GET /billing/usage failed [${res.status}]`);
  }
  return res.json() as Promise<UsageResponse>;
}

export async function fetchInvoices(): Promise<InvoiceSummary[]> {
  const res = await apiFetch<{ invoices: InvoiceSummary[] }>("/billing/invoices");
  return res.invoices;
}

export class BillingApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BillingApiError";
    this.status = status;
  }
}

export interface CheckoutSessionResponse {
  checkout_url: string;
  subscription_id: string;
  razorpay_key_id: string;
}

export async function createCheckoutSession(
  plan: "pro" | "business",
  interval: "month" | "year",
  idempotencyKey: string
): Promise<CheckoutSessionResponse> {
  const token = await (async () => {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    if (!t) throw new Error("Not authenticated");
    return t;
  })();

  const API_BASE = import.meta.env.VITE_API_BASE_URL as string;
  const res = await fetch(`${API_BASE}/billing/create-checkout-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ plan, interval }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    let detail = errorText;
    try {
      const parsed = JSON.parse(errorText) as { detail?: string };
      detail = parsed.detail ?? errorText;
    } catch {
      /* use raw text */
    }
    throw new BillingApiError(detail, res.status);
  }

  return res.json() as Promise<CheckoutSessionResponse>;
}

export async function downloadInvoice(invoiceId: string): Promise<void> {
  const { supabase } = await import("@/lib/supabase");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const API_BASE = import.meta.env.VITE_API_BASE_URL as string;
  const res = await fetch(`${API_BASE}/billing/invoices/${invoiceId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Download failed [${res.status}]`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `invoice-${invoiceId}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface SubscriptionInfo {
  has_subscription: boolean;
  plan: string;
  plan_status: string;
  razorpay_status: string | null;
  current_end: number | null;
  cancel_at_cycle_end: boolean;
  trial_ends_at: string | null;
}

export async function fetchSubscription(): Promise<SubscriptionInfo> {
  return apiFetch<SubscriptionInfo>("/billing/subscription");
}

export async function cancelSubscription(): Promise<{ status: string; at_cycle_end: boolean }> {
  return apiFetch("/billing/cancel-subscription", { method: "POST" });
}

export async function fetchBillingDetails(): Promise<BillingDetails> {
  const res = await apiFetch<{ billing_details: BillingDetails }>("/billing/details");
  return res.billing_details;
}

export async function updateBillingDetails(
  details: BillingDetails
): Promise<BillingDetails> {
  const res = await apiFetch<{ billing_details: BillingDetails }>("/billing/details", {
    method: "PATCH",
    body: JSON.stringify(details),
  });
  return res.billing_details;
}

export type QuotaLevel = "ok" | "warning" | "critical" | "blocked";

export function getQuotaLevel(used: number, limit: number): QuotaLevel {
  if (limit === -1) return "ok";
  if (limit === 0) return "blocked";
  const pct = used / limit;
  if (pct >= 1) return "blocked";
  if (pct >= 0.9) return "critical";
  if (pct >= 0.8) return "warning";
  return "ok";
}

export function getUsagePct(used: number, limit: number): number {
  if (limit === -1 || limit === 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export function getMonthResetDate(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
