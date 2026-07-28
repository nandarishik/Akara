import { describe, expect, it } from "vitest";

import { enrichDebriefMetrics } from "./debriefMetrics";

const sampleMeta = {
  headline: "Weekly Business Debrief",
  went_right: [
    {
      title: "Stable Order Numbers",
      detail:
        "The number of orders increased from 222 to 227, indicating a slight uptick in customer engagement.",
    },
  ],
  went_wrong: [
    {
      title: "Significant Revenue Decline",
      detail:
        "Total revenue dropped to ₹68,296 from ₹1,37,080, marking a substantial decrease in sales performance.",
      impact_inr: 68784,
    },
  ],
  actions: [],
  momentum: {
    projected_month_fmt: "₹4.8L",
    wow_change_pct: 0,
  },
};

describe("enrichDebriefMetrics", () => {
  it("parses revenue from narrative when momentum fields are missing", () => {
    const m = enrichDebriefMetrics(sampleMeta);
    expect(m.thisWeekRevenue).toBe(68296);
    expect(m.priorWeekRevenue).toBe(137080);
    expect(m.wowPct).toBe(-50);
    expect(m.hasRevenueCompare).toBe(true);
  });

  it("parses orders from narrative without trailing 'orders' word", () => {
    const m = enrichDebriefMetrics(sampleMeta);
    expect(m.orders).toBe(227);
    expect(m.priorOrders).toBe(222);
    expect(m.hasOrdersCompare).toBe(true);
  });

  it("uses formatted momentum strings when numeric fields absent", () => {
    const m = enrichDebriefMetrics({
      ...sampleMeta,
      went_wrong: [],
      went_right: [],
      momentum: {
        this_week_revenue_fmt: "₹1.2L",
        prior_week_revenue_fmt: "₹1.4L",
        wow_change_pct: 0,
      },
    });
    expect(m.thisWeekRevenue).toBe(120_000);
    expect(m.priorWeekRevenue).toBe(140_000);
  });
});
