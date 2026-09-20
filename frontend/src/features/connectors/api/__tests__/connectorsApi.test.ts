import { describe, expect, it } from "vitest";

import { _paths, CONNECTORS_API_PREFIX, connectorsApiPath } from "../connectorsApi";
import { customerErrorMessage, ERROR_MESSAGE_TEMPLATES } from "../errorMessages";

describe("connectorsApi paths", () => {
  it("uses /api/v1/connectors prefix", () => {
    expect(CONNECTORS_API_PREFIX).toBe("/api/v1/connectors");
    expect(_paths.list()).toContain("/api/v1/connectors");
    expect(_paths.detail("abc")).toBe("/api/v1/connectors/abc");
    expect(_paths.test("abc")).toContain("/api/v1/connectors/abc/test");
    expect(_paths.tallyPush()).toContain("/api/v1/connectors/tally/push");
    expect(connectorsApiPath(_paths.list())).toContain("/api/v1/connectors");
  });
});

describe("errorMessages", () => {
  it("replaces [Source] with source name", () => {
    expect(customerErrorMessage("INVALID_CREDENTIALS", "Brewlab")).toContain("Brewlab");
    expect(ERROR_MESSAGE_TEMPLATES.GATED).toContain("CSV");
  });
});
