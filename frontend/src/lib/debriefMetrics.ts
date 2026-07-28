type DebriefLike = {
  headline: string;
  went_right: { title: string; detail: string; hypothesis?: string; impact_inr?: number }[];
  went_wrong: { title: string; detail: string; hypothesis?: string; impact_inr?: number }[];
  actions: { title: string; detail: string }[];
  momentum?: {
    this_week_revenue?: number;
    prior_week_revenue?: number;
    this_week_revenue_fmt?: string;
    wow_change_pct?: number;
  };
  insights?: {
    week_metrics?: {
      revenue: number;
      prior_revenue: number;
      orders: number;
      prior_orders: number;
    };
  };
};

function parseInrToken(raw: string): number {
  const cleaned = raw.replace(/[₹,\s]/g, "");
  const m = cleaned.match(/^([\d.]+)(L|K|Cr)?$/i);
  if (!m) return 0;
  let n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return 0;
  const suffix = (m[2] ?? "").toUpperCase();
  if (suffix === "L") n *= 100_000;
  else if (suffix === "K") n *= 1_000;
  else if (suffix === "CR") n *= 10_000_000;
  return Math.round(n);
}

function allNarrativeText(meta: DebriefLike): string {
  const parts = [
    meta.headline,
    ...meta.went_right.flatMap((i) => [i.title, i.detail, i.hypothesis ?? ""]),
    ...meta.went_wrong.flatMap((i) => [i.title, i.detail, i.hypothesis ?? ""]),
    ...meta.actions.flatMap((i) => [i.title, i.detail]),
  ];
  return parts.join(" ");
}

/** Pull this/prior revenue from narrative when engine fields are empty (older debriefs). */
function parseRevenueFromNarrative(text: string): { current: number; prior: number } {
  const decline =
    text.match(
      /(?:to|at|reached?|dropped?\s+to|fell?\s+to)\s*₹([\d,]+(?:\.\d+)?(?:\s*(?:L|K|Cr))?)\s*(?:from|vs\.?|versus|compared\s+to)\s*₹([\d,]+(?:\.\d+)?(?:\s*(?:L|K|Cr))?)/i
    ) ??
    text.match(
      /₹([\d,]+(?:\.\d+)?(?:\s*(?:L|K|Cr))?)\s*(?:from|vs\.?|versus|compared\s+to)\s*₹([\d,]+(?:\.\d+)?(?:\s*(?:L|K|Cr))?)/i
    );
  if (decline) {
    return {
      current: parseInrToken(decline[1].replace(/\s+/g, "")),
      prior: parseInrToken(decline[2].replace(/\s+/g, "")),
    };
  }
  return { current: 0, prior: 0 };
}

function parseOrdersFromNarrative(text: string): { current: number; prior: number } {
  const up =
    text.match(/(?:from|increased\s+from)\s*(\d+)\s*(?:to|orders?\s+to)\s*(\d+)\s*orders?/i) ??
    text.match(/(\d+)\s*orders?\s*(?:vs|versus|compared\s+to|from)\s*(\d+)/i);
  if (up) {
    const a = parseInt(up[1], 10);
    const b = parseInt(up[2], 10);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return a > b ? { current: a, prior: b } : { current: b, prior: a };
    }
  }
  const single = text.match(/(\d+)\s*orders?/i);
  if (single) return { current: parseInt(single[1], 10), prior: 0 };
  return { current: 0, prior: 0 };
}

export type EnrichedDebriefMetrics = {
  thisWeekRevenue: number;
  priorWeekRevenue: number;
  thisWeekRevenueDisplay: string;
  orders: number;
  priorOrders: number;
  wowPct: number;
  wowUp: boolean;
  wowDown: boolean;
  hasRevenueCompare: boolean;
  hasOrdersCompare: boolean;
};

export function enrichDebriefMetrics(meta: DebriefLike): EnrichedDebriefMetrics {
  const m = meta.momentum;
  let thisWeek = m?.this_week_revenue ?? meta.insights?.week_metrics?.revenue ?? 0;
  let priorWeek = m?.prior_week_revenue ?? meta.insights?.week_metrics?.prior_revenue ?? 0;
  let orders = meta.insights?.week_metrics?.orders ?? 0;
  let priorOrders = meta.insights?.week_metrics?.prior_orders ?? 0;

  const narrative = allNarrativeText(meta);

  if (!thisWeek || !priorWeek) {
    const parsed = parseRevenueFromNarrative(narrative);
    if (parsed.current) thisWeek = thisWeek || parsed.current;
    if (parsed.prior) priorWeek = priorWeek || parsed.prior;
  }

  if (!orders || !priorOrders) {
    const parsedOrders = parseOrdersFromNarrative(narrative);
    if (parsedOrders.current) orders = orders || parsedOrders.current;
    if (parsedOrders.prior) priorOrders = priorOrders || parsedOrders.prior;
  }

  let wowPct = m?.wow_change_pct ?? 0;
  if (priorWeek > 0 && thisWeek > 0 && wowPct === 0) {
    wowPct = Math.round(((thisWeek - priorWeek) / priorWeek) * 100);
  }

  const fmt = m?.this_week_revenue_fmt;
  const displayFromFmt =
    fmt && fmt !== "₹—" && fmt !== "—" && fmt !== "" ? fmt : "";

  return {
    thisWeekRevenue: thisWeek,
    priorWeekRevenue: priorWeek,
    thisWeekRevenueDisplay: thisWeek > 0 ? "" : displayFromFmt,
    orders,
    priorOrders,
    wowPct,
    wowUp: wowPct > 0,
    wowDown: wowPct < 0,
    hasRevenueCompare: thisWeek > 0 && priorWeek > 0,
    hasOrdersCompare: orders > 0 && priorOrders > 0,
  };
}

export function impactFromItem(detail: string, impact_inr?: number): number {
  if (impact_inr && impact_inr > 0) return impact_inr;
  const amounts = [...detail.matchAll(/₹([\d,]+(?:\.\d+)?)\s*(L|K|Cr)?/gi)].map((match) =>
    parseInrToken(match[1] + (match[2] ?? ""))
  );
  return amounts.length ? Math.max(...amounts) : 0;
}

export function formatInrDisplay(n: number): string {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}
