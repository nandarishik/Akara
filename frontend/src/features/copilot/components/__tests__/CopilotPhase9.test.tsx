import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AIOutageBanner } from "../AIOutageBanner";
import { ConfidenceIndicator } from "../ConfidenceIndicator";
import { CopilotEvidence } from "../CopilotEvidence";
import { parseStreamChunk } from "../../hooks/useCopilot";

describe("CopilotEvidence", () => {
  it("renders order count and confidence", () => {
    render(
      <CopilotEvidence
        evidence={{
          order_count: 1247,
          data_range: "2026-08-31 to 2026-09-06",
          confidence: "high",
          confidence_reason: "Based on 1,247 orders",
          sql_summary: "Aggregated revenue from canonical_orders",
        }}
      />,
    );
    expect(screen.getByText(/Based on 1,247 orders/i)).toBeTruthy();
    expect(screen.getByText(/Confidence: High/i)).toBeTruthy();
  });

  it("renders limited data warnings", () => {
    render(
      <CopilotEvidence
        evidence={{
          confidence: "low",
          warnings: ["Limited data: only 2 day(s) available"],
        }}
      />,
    );
    expect(screen.getByText(/Limited data: only 2 day/i)).toBeTruthy();
  });
});

describe("ConfidenceIndicator", () => {
  it("shows medium label", () => {
    render(<ConfidenceIndicator confidence="medium" />);
    expect(screen.getByText(/Confidence: Medium/i)).toBeTruthy();
  });
});

describe("AIOutageBanner", () => {
  it("hides when llm available", () => {
    const { container } = render(
      <MemoryRouter>
        <AIOutageBanner status={{ llm_available: true }} />
      </MemoryRouter>,
    );
    expect(container.textContent).toBe("");
  });

  it("shows dashboard link when unavailable", () => {
    render(
      <MemoryRouter>
        <AIOutageBanner
          status={{
            llm_available: false,
            reason: "All LLM providers are currently unreachable.",
            dashboard_available: true,
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/unreachable/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open dashboard/i })).toBeTruthy();
  });
});

describe("parseStreamChunk", () => {
  it("parses phase and evidence", () => {
    expect(parseStreamChunk('{"type":"phase","phase":"querying"}')).toEqual({
      kind: "phase",
      phase: "querying",
    });
    const ev = parseStreamChunk(
      '{"type":"evidence","evidence":{"order_count":10,"confidence":"medium"},"message_id":"m1"}',
    );
    expect(ev.kind).toBe("evidence");
    if (ev.kind === "evidence") {
      expect(ev.evidence.order_count).toBe(10);
    }
  });
});
