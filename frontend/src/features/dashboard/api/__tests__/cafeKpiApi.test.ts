import { describe, expect, it } from "vitest";

import { _paths, buildFilterQuery, cafeKpiPath } from "../cafeKpiApi";

describe("cafeKpiApi paths", () => {
  it("uses /kpi and /metrics prefixes", () => {
    expect(_paths.summary()).toContain("/kpi/summary");
    expect(_paths.trends()).toContain("/kpi/trends");
    expect(_paths.flags()).toContain("/kpi/flags");
    expect(_paths.metrics()).toContain("/metrics");
    expect(cafeKpiPath("/kpi/summary")).toContain("/kpi/summary");
  });

  it("builds filter query", () => {
    expect(buildFilterQuery({ from: "2026-09-01", channel: "dine-in" })).toContain("from=");
    expect(buildFilterQuery({ from: "2026-09-01", channel: "dine-in" })).toContain("channel=");
  });
});
