import type { AuthError } from "@supabase/supabase-js";

/**
 * Normalize Supabase auth errors into a user-facing string.
 */
export function formatAuthError(err: unknown, fallback = "Something went wrong"): string {
  if (!err) return fallback;

  if (typeof err === "object" && err !== null && "message" in err) {
    const message = String((err as AuthError).message).trim();
    if (message) return message;
  }

  if (err instanceof Error && err.message.trim()) {
    return err.message.trim();
  }

  return fallback;
}
