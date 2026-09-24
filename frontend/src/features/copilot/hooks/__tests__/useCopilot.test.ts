import { describe, expect, it } from "vitest";

import { parseStreamChunk } from "../useCopilot";

describe("parseStreamChunk", () => {
  it("keeps conversation_id", () => {
    expect(parseStreamChunk('{"type":"conversation_id","id":"abc"}')).toEqual({
      kind: "conversation_id",
      id: "abc",
    });
  });

  it("parses phase events", () => {
    expect(parseStreamChunk('{"type":"phase","phase":"composing"}')).toEqual({
      kind: "phase",
      phase: "composing",
    });
  });

  it("parses evidence events", () => {
    const parsed = parseStreamChunk(
      '{"type":"evidence","evidence":{"order_count":3,"confidence":"low"},"langfuse_trace_id":"t1"}',
    );
    expect(parsed.kind).toBe("evidence");
    if (parsed.kind === "evidence") {
      expect(parsed.evidence.order_count).toBe(3);
      expect(parsed.meta.langfuse_trace_id).toBe("t1");
    }
  });

  it("parses error chunks", () => {
    const parsed = parseStreamChunk(
      '{"error":"ai_unavailable","message":"down","llm_available":false}',
    );
    expect(parsed).toMatchObject({ kind: "error", message: "down", llm_available: false });
  });

  it("treats plain text as text", () => {
    expect(parseStreamChunk("hello")).toEqual({ kind: "text", text: "hello" });
  });
});
