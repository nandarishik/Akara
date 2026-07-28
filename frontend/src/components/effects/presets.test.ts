import { describe, expect, it } from "vitest";

import { BORDER_GLOW_CARD, BORDER_GLOW_DEFAULTS } from "@/components/effects/presets";
import { parseHSL } from "@/components/effects/BorderGlow";

describe("border glow presets", () => {
  it("uses React Bits spec defaults", () => {
    expect(BORDER_GLOW_DEFAULTS.backgroundColor).toBe("#120F17");
    expect(BORDER_GLOW_DEFAULTS.colors).toEqual(["#c084fc", "#f472b6", "#38bdf8"]);
    expect(BORDER_GLOW_DEFAULTS.glowColor).toBe("40 80 80");
  });

  it("card preset tightens radius", () => {
    expect(BORDER_GLOW_CARD.borderRadius).toBe(16);
    expect(BORDER_GLOW_CARD.glowRadius).toBe(32);
  });

  it("parseHSL reads glow string", () => {
    expect(parseHSL("40 80 80")).toEqual({ h: 40, s: 80, l: 80 });
  });
});
