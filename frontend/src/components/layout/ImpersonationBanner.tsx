import { useAuth } from "@/contexts/AuthContext";
import { superadminFetch } from "@/lib/api/superadmin";
import { supabase } from "@/lib/supabase";

export function ImpersonationBanner() {
  const { user } = useAuth();
  const name = user?.impersonatingTenantName;

  if (!name) return null;

  async function exitImpersonation() {
    try {
      await superadminFetch("/superadmin/impersonate/stop", {
        method: "POST",
        body: JSON.stringify({
          session_id: user?.impersonationSessionId || undefined,
          reason: "Superadmin exited impersonation session from customer banner",
        }),
      });
    } catch {
      // Still sign out if stop fails (session may already be ended)
    }
    await supabase.auth.signOut();
    window.location.href = "/superadmin/tenants";
  }

  return (
    <div
      className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-black"
      role="alert"
    >
      <span>Viewing AKARA as {name}</span>
      <button type="button" className="underline" onClick={() => void exitImpersonation()}>
        Exit impersonation
      </button>
    </div>
  );
}
