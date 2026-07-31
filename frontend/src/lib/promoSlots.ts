/** Dismissible promo slot helpers — localStorage keys per slot letter. */

export function isSlotDismissed(key: string): boolean {
  return localStorage.getItem(key) === "1";
}

export function dismissSlot(key: string): void {
  localStorage.setItem(key, "1");
}

export function getVisitCount(key: string): number {
  return Number(localStorage.getItem(key) || "0");
}

export function incrementVisitCount(key: string): number {
  const next = getVisitCount(key) + 1;
  localStorage.setItem(key, String(next));
  return next;
}

export const SLOT_KEYS = {
  A: "akara_slot_A_dismissed",
  B: "akara_slot_B_dismissed",
  C: "akara_slot_C_dismissed",
  D: "akara_slot_D_dismissed",
  E: "akara_slot_E_dismissed",
  E_VIEWS: "akara_slot_E_views",
  F: "akara_slot_F_dismissed",
  F_VIEWS: "akara_slot_F_views",
  G: "akara_slot_G_dismissed",
  H: "akara_slot_H_dismissed",
  I: "akara_slot_I_dismissed",
  J: "akara_slot_J_dismissed",
  K: "akara_slot_K_dismissed",
  L: "akara_slot_L_dismissed",
  M: "akara_slot_M_dismissed",
  /** In-app quota warning dismiss (UsageBanner 80%+) */
  N: "akara_slot_N_dismissed",
  /** Backend activation email ops (cron: activation_emails) — registry only */
  O: "akara_slot_O_dismissed",
} as const;

/** CMS placement_slots.key values — separate from localStorage dismiss keys. */
export const PLACEMENT_KEYS = {
  A: "landing.banner.a",
  B: "landing.banner.b",
  C: "landing.banner.c",
  D: "dashboard.welcome",
  E: "landing.pricing.nudge",
  F: "copilot.demo",
  G: "data.pro_upsell",
  H: "billing.quota_nudge",
  I: "reports.insight",
  J: "settings.tip",
  K: "onboarding.hint",
  L: "copilot.quota_blocked",
  M: "team.invite",
  N: "usage.warning",
  O: "activation.ops",
} as const;

export const ALL_PLACEMENT_KEY_VALUES = Object.values(PLACEMENT_KEYS);

/** One-time migration from legacy landing banner key. */
export function migrateLegacySlotA(): void {
  if (localStorage.getItem("banner_wa_dismissed") === "true" && !isSlotDismissed(SLOT_KEYS.A)) {
    dismissSlot(SLOT_KEYS.A);
  }
}
