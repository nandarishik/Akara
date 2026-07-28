import type { Session } from "@supabase/supabase-js";
import type { User } from "@/types";

/** True for tenant admin or platform superadmin. */
export function isAdmin(
  user: User | null,
  session: Session | null
): boolean {
  if (user?.role === "admin" || user?.role === "superadmin") return true;
  const metaRole = session?.user?.user_metadata?.role;
  return metaRole === "admin" || metaRole === "superadmin";
}

export function isSuperadmin(user: User | null): boolean {
  return user?.role === "superadmin";
}

export function roleLabel(
  user: User | null,
  session: Session | null
): "Superadmin" | "Admin" | "Viewer" {
  if (user?.role === "superadmin") return "Superadmin";
  if (isAdmin(user, session)) return "Admin";
  return "Viewer";
}
