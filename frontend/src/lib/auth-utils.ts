import type { Session } from "@supabase/supabase-js";
import type { User } from "@/types";

/** True for tenant admin, owner, or platform superadmin. */
export function isAdmin(
  user: User | null,
  session: Session | null
): boolean {
  if (user?.role === "admin" || user?.role === "owner" || user?.role === "superadmin") return true;
  const metaRole = session?.user?.user_metadata?.role;
  return metaRole === "admin" || metaRole === "owner" || metaRole === "superadmin";
}

export function isSuperadmin(user: User | null): boolean {
  return user?.role === "superadmin";
}

/** True only for workspace owner. */
export function isOwner(user: User | null, session: Session | null): boolean {
  if ((user?.role as string | undefined) === "owner") return true;
  return session?.user?.user_metadata?.role === "owner";
}

export function roleLabel(
  user: User | null,
  session: Session | null
): "Superadmin" | "Admin" | "Owner" | "Viewer" {
  if (user?.role === "superadmin") return "Superadmin";
  if (user?.role === "owner" || session?.user?.user_metadata?.role === "owner") return "Owner";
  if (isAdmin(user, session)) return "Admin";
  return "Viewer";
}
