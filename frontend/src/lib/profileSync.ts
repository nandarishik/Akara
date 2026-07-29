export type ProfileUpdateDetail = {
  displayName?: string;
  avatarSeed?: string;
};

export const PROFILE_UPDATED_EVENT = "akara:profile-updated";

const DISPLAY_NAME_CACHE_KEY = "akara_display_name";
const AVATAR_SEED_CACHE_KEY = "akara_avatar_seed";

export function notifyProfileUpdated(detail: ProfileUpdateDetail): void {
  if (typeof window === "undefined") return;
  try {
    if (detail.displayName) {
      sessionStorage.setItem(DISPLAY_NAME_CACHE_KEY, detail.displayName);
    }
    if (detail.avatarSeed) {
      sessionStorage.setItem(AVATAR_SEED_CACHE_KEY, detail.avatarSeed);
    }
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail }));
}

export function readCachedDisplayName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(DISPLAY_NAME_CACHE_KEY);
  } catch {
    return null;
  }
}
