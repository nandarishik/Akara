/** React Bits BorderGlow spec defaults — do not AKARA-tint. */
export const BORDER_GLOW_DEFAULTS = {
  backgroundColor: "#0a0a0a",
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

/** Product app — AKARA cyan/magenta tuned (dashboard, auth, billing). */
export const BORDER_GLOW_PRODUCT = {
  ...BORDER_GLOW_DEFAULTS,
  backgroundColor: "#0a0a0a",
  colors: ["#D856BF", "#03B3C3", "#38bdf8"] as string[],
  glowColor: "192 80 70",
  borderRadius: 16,
  glowRadius: 32,
} as const;

export const BORDER_GLOW_PRODUCT_CARD = {
  ...BORDER_GLOW_PRODUCT,
  borderRadius: 16,
  glowRadius: 28,
} as const;

export const LINE_SIDEBAR_AKARA = {
  accentColor: "#03B3C3",
  textColor: "#9ca3af",
  markerColor: "#4b5563",
  showIndex: true,
  showMarker: true,
  proximityRadius: 80,
  maxShift: 20,
  markerLength: 48,
  fontSize: 0.95,
  itemGap: 16,
} as const;

export const STRANDS_COPILOT_MINI = {
  colors: ["#D856BF", "#03B3C3", "#0E5EA5"] as string[],
  count: 2,
  speed: 0.45,
  amplitude: 0.6,
  waviness: 1,
  thickness: 0.6,
  glow: 1.4,
  taper: 3,
  spread: 1,
  intensity: 0.55,
  saturation: 1.3,
  opacity: 1,
  scale: 0.85,
  glass: false,
} as const;

export const STRANDS_COPILOT_INLINE = {
  ...STRANDS_COPILOT_MINI,
  count: 2,
  scale: 1.1,
  amplitude: 0.45,
  glow: 1.2,
} as const;

/** Beside Copilot input — larger, multi-strand “alien intelligence” orb */
export const STRANDS_COPILOT_COMPANION = {
  colors: ["#7C3AED", "#03B3C3", "#D856BF", "#22D3EE"] as string[],
  count: 3,
  speed: 0.32,
  amplitude: 0.85,
  waviness: 1.25,
  thickness: 0.7,
  glow: 2.2,
  taper: 2.5,
  spread: 0.9,
  intensity: 0.9,
  saturation: 1.6,
  opacity: 1,
  scale: 1.2,
  glass: false,
} as const;
