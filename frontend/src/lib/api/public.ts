const BASE = import.meta.env.VITE_API_BASE_URL as string;

export interface PublicPlan {
  code: string;
  display_name: string;
  description?: string;
  currency: string;
  monthly_price_minor: number;
  annual_price_minor?: number | null;
  limits?: Record<string, unknown>;
  entitlements?: Record<string, unknown>;
  cta_label?: string;
  sort_order?: number;
}

export async function fetchPublicPlans(): Promise<PublicPlan[]> {
  const res = await fetch(`${BASE}/public/plans`);
  if (!res.ok) throw new Error(`Failed to load plans: ${res.status}`);
  const data = (await res.json()) as { items: PublicPlan[] };
  return data.items ?? [];
}

export async function fetchPublicContent(key: string, locale = "en-IN"): Promise<unknown> {
  const res = await fetch(`${BASE}/public/content/${encodeURIComponent(key)}?locale=${locale}`);
  if (!res.ok) throw new Error(`Failed to load content: ${res.status}`);
  const data = (await res.json()) as { value: unknown };
  return data.value;
}

export async function fetchPublicPlacements(options?: {
  plan?: string;
  page?: string;
}): Promise<
  Array<{ key: string; kind: string; published_content: Record<string, unknown>; audience_rules?: Record<string, unknown> }>
> {
  const params = new URLSearchParams();
  if (options?.plan) params.set("plan", options.plan);
  if (options?.page) params.set("page", options.page);
  const qs = params.toString();
  const res = await fetch(`${BASE}/public/placements${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`Failed to load placements: ${res.status}`);
  const data = (await res.json()) as {
    items: Array<{ key: string; kind: string; published_content: Record<string, unknown>; audience_rules?: Record<string, unknown> }>;
  };
  return data.items ?? [];
}

export async function fetchPublicLegal(documentKey: string): Promise<{
  version?: string;
  title?: string;
  body_markdown?: string;
  effective_at?: string;
  metadata?: { target_plans?: string[] };
} | null> {
  const res = await fetch(`${BASE}/public/legal/${documentKey}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { document: Record<string, string> | null };
  return data.document;
}

export function formatInrFromMinor(minor: number): string {
  if (minor === 0) return "₹0";
  return `₹${(minor / 100).toLocaleString("en-IN")}`;
}

export async function trackPlacementImpression(slotKey: string): Promise<void> {
  try {
    await fetch(`${BASE}/public/placements/${encodeURIComponent(slotKey)}/impression`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata: {} }),
    });
  } catch {
    // non-blocking analytics
  }
}

export async function trackPlacementClick(slotKey: string): Promise<void> {
  try {
    await fetch(`${BASE}/public/placements/${encodeURIComponent(slotKey)}/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata: {} }),
    });
  } catch {
    // non-blocking analytics
  }
}
