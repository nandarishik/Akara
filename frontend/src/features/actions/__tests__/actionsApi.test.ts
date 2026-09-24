import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

import {
  acceptAction,
  fetchAction,
  fetchActionHistory,
  fetchActionOutcomes,
  fetchActionSummary,
  fetchActions,
  rejectAction,
  setActionsMocks,
  snoozeAction,
} from "../api/actionsApi";

describe("actionsApi", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    setActionsMocks(false);
  });

  it("uses unversioned frozen paths", async () => {
    apiFetch.mockResolvedValue({ items: [], open_count: 0 });
    await fetchActions();
    expect(apiFetch).toHaveBeenCalledWith("/actions");

    apiFetch.mockResolvedValue({ items: [] });
    await fetchActionHistory();
    expect(apiFetch).toHaveBeenCalledWith("/actions/history");

    await fetchActionOutcomes();
    expect(apiFetch).toHaveBeenCalledWith("/actions/outcomes");

    apiFetch.mockResolvedValue({ open_count: 0 });
    await fetchActionSummary();
    expect(apiFetch).toHaveBeenCalledWith("/actions/summary");

    apiFetch.mockResolvedValue({ id: "1" });
    await fetchAction("1");
    expect(apiFetch).toHaveBeenCalledWith("/actions/1");

    await acceptAction("1", null);
    expect(apiFetch).toHaveBeenCalledWith("/actions/1/accept", {
      method: "POST",
      body: JSON.stringify({ notes: null }),
    });

    await snoozeAction("1", 7, null);
    expect(apiFetch).toHaveBeenCalledWith("/actions/1/snooze", {
      method: "POST",
      body: JSON.stringify({ reason: null, days: 7 }),
    });

    await rejectAction("1", "Already done this");
    expect(apiFetch).toHaveBeenCalledWith("/actions/1/reject", {
      method: "POST",
      body: JSON.stringify({ reason: "Already done this" }),
    });
  });

  it("sends sort and type query params", async () => {
    apiFetch.mockResolvedValue({ items: [], open_count: 0 });
    await fetchActions({ sort: "impact", type: "menu_engineering" });
    expect(apiFetch).toHaveBeenCalledWith("/actions?sort=impact&type=menu_engineering");
  });
});
