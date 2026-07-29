const DICEBEAR_STYLE = "notionists-neutral";

export const AVATAR_PRESETS = [
  "Alex",
  "Blair",
  "Casey",
  "Devon",
  "Elena",
  "Finn",
  "Grace",
  "Harper",
  "Indigo",
  "Jordan",
  "Kai",
  "Luna",
] as const;

export type AvatarSeed = (typeof AVATAR_PRESETS)[number] | string;

export function dicebearUrl(seed: string): string {
  return `https://api.dicebear.com/9.x/${DICEBEAR_STYLE}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=1a1a1a,262626,333333,404040`;
}

export function defaultAvatarSeed(userId?: string | null, email?: string | null): string {
  if (userId) return userId.slice(0, 8);
  if (email) return email.split("@")[0] ?? "akara";
  return "akara";
}

type ProfileLike = {
  avatar_seed?: string | null;
  preferences?: { avatar_seed?: string | null } | null;
  id?: string;
  email?: string | null;
};

export function getAvatarSeed(profile: ProfileLike | null | undefined, fallbackEmail?: string | null): string {
  const fromPrefs = profile?.preferences?.avatar_seed ?? profile?.avatar_seed;
  if (fromPrefs) return fromPrefs;
  return defaultAvatarSeed(profile?.id, fallbackEmail ?? profile?.email);
}

export function getUserAvatarUrl(
  profile: ProfileLike | null | undefined,
  fallbackEmail?: string | null
): string {
  return dicebearUrl(getAvatarSeed(profile, fallbackEmail));
}
