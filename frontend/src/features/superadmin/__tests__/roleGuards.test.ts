import { describe, expect, it } from "vitest";

import { canAccessPath, allowedRolesForPath } from "../lib/roleGuards";

describe("roleGuards", () => {
  it("excludes SUPPORT from query-console", () => {
    expect(canAccessPath("/superadmin/query-console", "SUPPORT")).toBe(false);
    expect(allowedRolesForPath("/superadmin/query-console")).toEqual(["SUPER_ADMIN"]);
  });

  it("allows BILLING_OPS on billing", () => {
    expect(canAccessPath("/superadmin/billing", "BILLING_OPS")).toBe(true);
  });

  it("treats null role as SUPER_ADMIN", () => {
    expect(canAccessPath("/superadmin/jobs", null)).toBe(true);
  });
});
