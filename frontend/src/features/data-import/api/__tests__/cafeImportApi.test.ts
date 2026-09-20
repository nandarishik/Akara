import { describe, expect, it } from "vitest";

import { _paths, cafeApiPath } from "../cafeImportApi";

describe("cafeImportApi paths", () => {
  it("builds cafe-orders upload path", () => {
    expect(_paths.cafeOrders()).toContain("/data/imports/cafe-orders");
    expect(cafeApiPath("/data/imports/cafe-orders")).toContain("/data/imports/cafe-orders");
  });

  it("builds import jobs list path", () => {
    expect(_paths.importJobs()).toContain("/data/import/jobs");
  });

  it("builds status path", () => {
    expect(_paths.status("abc")).toContain("/data/imports/abc/status");
  });
});
