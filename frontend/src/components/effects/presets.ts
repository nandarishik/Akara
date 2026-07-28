/** React Bits BorderGlow spec defaults — do not AKARA-tint. */
export const BORDER_GLOW_DEFAULTS = {
  backgroundColor: "#120F17",
  colors: ["#c084fc", "#f472b6", "#38bdf8"] as string[],
  glowColor: "40 80 80",
  borderRadius: 28,
  glowRadius: 40,
  glowIntensity: 1.0,
  edgeSensitivity: 30,
  coneSpread: 25,
  animated: false,
  fillOpacity: 0.5,
} as const;

export type BorderGlowPreset = typeof BORDER_GLOW_DEFAULTS;

/** Card-sized glow — slightly tighter radius for product cards. */
export const BORDER_GLOW_CARD = {
  ...BORDER_GLOW_DEFAULTS,
  borderRadius: 16,
  glowRadius: 32,
} as const;

/** CTA button wrapper — tight glow around SpecularButton. */
export const BORDER_GLOW_BUTTON = {
  ...BORDER_GLOW_DEFAULTS,
  borderRadius: 18,
  glowRadius: 20,
  fillOpacity: 0.35,
} as const;
