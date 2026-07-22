import type { Session } from "@supabase/supabase-js";
import type { User } from "@/types";

/** Resolve admin role from API profile or Supabase session metadata fallback. */
export function isAdmin(
  user: User | null,
  session: Session | null
): boolean {
  if (user?.role === "admin") return true;
  return session?.user?.user_metadata?.role === "admin";
}

export function roleLabel(
  user: User | null,
  session: Session | null
): "Admin" | "Viewer" {
  return isAdmin(user, session) ? "Admin" : "Viewer";
}
