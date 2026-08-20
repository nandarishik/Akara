type DebriefLike = {
  headline: string;
  went_right: { title: string; detail: string; hypothesis?: string; impact_inr?: number }[];
  went_wrong: { title: string; detail: string; hypothesis?: string; impact_inr?: number }[];
  actions: { title: string; detail: string }[];
  momentum?: {
    this_week_revenue?: number;
    prior_week_revenue?: number;
    this_week_revenue_fmt?: string;
    prior_week_revenue_fmt?: string;
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

const CURRENCY = String.raw`(?:₹|Rs\.?|INR\s*)?`;

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

function parseAmountString(s: string): number {
  const trimmed = s.trim();
  if (!trimmed || trimmed === "—" || trimmed === "₹—") return 0;
  const symbolMatch = trimmed.match(new RegExp(`${CURRENCY}([\\d,]+(?:\\.\\d+)?)\\s*(L|K|Cr)?`, "i"));
  if (symbolMatch) {
    return parseInrToken(symbolMatch[1] + (symbolMatch[2] ?? ""));
  }
  return parseInrToken(trimmed);
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

function parseRevenueFromNarrative(text: string): { current: number; prior: number } {
  const toFrom = text.match(
    new RegExp(
      `(?:to|at|reached?|dropped?\\s+to|fell?\\s+to|increased?\\s+to|rose\\s+to)\\s*${CURRENCY}([\\d,]+(?:\\.\\d+)?(?:\\s*(?:L|K|Cr))?)\\s*(?:from|vs\\.?|versus|compared\\s+to)\\s*${CURRENCY}([\\d,]+(?:\\.\\d+)?(?:\\s*(?:L|K|Cr))?)`,
      "i"
    )
  );
  if (toFrom) {
    return {
      current: parseAmountString(toFrom[1]),
      prior: parseAmountString(toFrom[2]),
    };
  }

  const fromTo = text.match(
    new RegExp(
      `(?:from|vs\\.?|versus|compared\\s+to)\\s*${CURRENCY}([\\d,]+(?:\\.\\d+)?(?:\\s*(?:L|K|Cr))?)\\s*(?:to|at|reached?)\\s*${CURRENCY}([\\d,]+(?:\\.\\d+)?(?:\\s*(?:L|K|Cr))?)`,
      "i"
    )
  );
  if (fromTo) {
    return {
      current: parseAmountString(fromTo[2]),
      prior: parseAmountString(fromTo[1]),
    };
  }

  const plain = text.match(
    /(?:to|at|dropped?\s+to|fell?\s+to)\s*([\d,]+)\s*(?:from|vs\.?|versus|compared\s+to)\s*([\d,]+)/i
  );
  if (plain) {
    return {
      current: parseAmountString(plain[1]),
      prior: parseAmountString(plain[2]),
    };
  }

  return { current: 0, prior: 0 };
}

function parseOrdersFromNarrative(text: string): { current: number; prior: number } {
  const patterns = [
    /(?:from|increased\s+from)\s*(\d+)\s+to\s+(\d+)/i,
    /(\d+)\s+to\s+(\d+)\s+orders?/i,
    /(\d+)\s*orders?\s*(?:vs|versus|compared\s+to|from)\s*(\d+)/i,
    /(\d+)\s*orders?/i,
  ];

  for (let i = 0; i < patterns.length - 1; i++) {
    const match = text.match(patterns[i]);
    if (match) {
      const a = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        return a > b ? { current: a, prior: b } : { current: b, prior: a };
      }
    }
  }

  const single = text.match(patterns[patterns.length - 1]);
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
  revenueKnown: boolean;
  ordersKnown: boolean;
};

export function enrichDebriefMetrics(meta: DebriefLike): EnrichedDebriefMetrics {
  const m = meta.momentum;
  let thisWeek = m?.this_week_revenue ?? meta.insights?.week_metrics?.revenue;
  let priorWeek = m?.prior_week_revenue ?? meta.insights?.week_metrics?.prior_revenue;
  let orders = meta.insights?.week_metrics?.orders;
  let priorOrders = meta.insights?.week_metrics?.prior_orders;

  if (thisWeek == null && m?.this_week_revenue_fmt) {
    thisWeek = parseAmountString(m.this_week_revenue_fmt);
  }
  if (priorWeek == null && m?.prior_week_revenue_fmt) {
    priorWeek = parseAmountString(m.prior_week_revenue_fmt);
  }

  thisWeek = thisWeek ?? 0;
  priorWeek = priorWeek ?? 0;
  orders = orders ?? 0;
  priorOrders = priorOrders ?? 0;

  const narrative = allNarrativeText(meta);
  const revenueKnown =
    m?.this_week_revenue != null ||
    Boolean(m?.this_week_revenue_fmt && m.this_week_revenue_fmt !== "₹—") ||
    meta.insights?.week_metrics?.revenue != null;

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
  if (priorWeek > 0 && thisWeek >= 0 && (wowPct === 0 || m?.wow_change_pct == null)) {
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
    revenueKnown: revenueKnown || thisWeek > 0 || Boolean(displayFromFmt),
    ordersKnown: orders > 0 || meta.insights?.week_metrics?.orders != null,
  };
}

export function impactFromItem(detail: string, impact_inr?: number): number {
  if (impact_inr && impact_inr > 0) return impact_inr;
  const amounts = [...detail.matchAll(/(?:₹|Rs\.?|INR\s*)?([\d,]+(?:\.\d+)?)\s*(L|K|Cr)?/gi)].map(
    (match) => parseInrToken(match[1] + (match[2] ?? ""))
  );
  return amounts.length ? Math.max(...amounts) : 0;
}

export function formatInrDisplay(n: number): string {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

const REVENUE_HINT = /\brevenue\b|₹|inr/i;
const DECLINE_WORDS = /\b(declin\w*|drop\w*|fell|fallen|down|decrease\w*|slipped|lost|below)\b/i;
const GROWTH_WORDS = /\b(grew|growth|gain\w*|up|increase\w*|rose|ris\w*|higher|beat)\b/i;

function itemClaimsRevenueDecline(item: DebriefLike["went_wrong"][number]): boolean {
  const text = `${item.title} ${item.detail} ${item.hypothesis ?? ""}`;
  return REVENUE_HINT.test(text) && DECLINE_WORDS.test(text);
}

function itemClaimsRevenueGrowth(item: DebriefLike["went_right"][number]): boolean {
  const text = `${item.title} ${item.detail} ${item.hypothesis ?? ""}`;
  return REVENUE_HINT.test(text) && GROWTH_WORDS.test(text);
}

/** Drop narrative bullets that disagree with structured week metrics (stale LLM copy). */
export function sanitizeDebriefNarrative<T extends DebriefLike>(meta: T): T {
  const rev = meta.momentum?.this_week_revenue ?? meta.insights?.week_metrics?.revenue;
  const prior = meta.momentum?.prior_week_revenue ?? meta.insights?.week_metrics?.prior_revenue;
  if (rev == null || prior == null) return meta;

  const revenueUp = rev >= prior;
  const badHeadline =
    REVENUE_HINT.test(meta.headline) &&
    (revenueUp ? DECLINE_WORDS : GROWTH_WORDS).test(meta.headline);

  if (revenueUp) {
    return {
      ...meta,
      headline: badHeadline
        ? `Revenue grew ${formatInrDisplay(rev - prior)} vs last week.`
        : meta.headline,
      went_wrong: meta.went_wrong.filter((item) => !itemClaimsRevenueDecline(item)),
    };
  }
  return {
    ...meta,
    headline: badHeadline
      ? `Revenue fell ${formatInrDisplay(prior - rev)} vs last week.`
      : meta.headline,
    went_right: meta.went_right.filter((item) => !itemClaimsRevenueGrowth(item)),
  };
}
