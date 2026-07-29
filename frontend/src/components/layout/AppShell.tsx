import { useState, useEffect } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ImpersonationBanner } from "@/components/layout/ImpersonationBanner";
import { MaintenanceOverlay, SystemBanner } from "@/components/layout/SystemBanner";
import AppLineSidebar from "@/components/layout/AppLineSidebar";
import ProfileDropdown from "@/components/layout/ProfileDropdown";
import DarkMeshBackground from "@/components/effects/DarkMeshBackground";
import { useBilling } from "@/hooks/useBilling";
import { UsageBanner, PastDueBanner, TrialWarning } from "@/components/billing";
import { GlowCTALink } from "@/components/ui/GlowCTAButton";
import { APP_NAV_ITEMS } from "@/lib/appNav";
import { APP_NAV_GLASS } from "@/lib/glassIconMap";
import { GlassIcon } from "@/components/effects/GlassIcon";
import { getQuotaLevel } from "@/lib/api/billing";
import { getUserAvatarUrl, readCachedAvatarSeed } from "@/lib/avatar";
import {
  PROFILE_UPDATED_EVENT,
  readCachedDisplayName,
  type ProfileUpdateDetail,
} from "@/lib/profileSync";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileNavProvider } from "@/contexts/MobileNavContext";

export { APP_NAV_ITEMS as NAV_ITEMS };

export function AppShell() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [avatarSeed, setAvatarSeed] = useState<string | null>(() => readCachedAvatarSeed());
  const [displayName, setDisplayName] = useState<string | null>(() => readCachedDisplayName());
  const { data: usage } = useBilling();

  useEffect(() => {
    if (!user?.id) return;

    async function loadProfileFields() {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("preferences, display_name")
          .eq("id", user!.id)
          .single();
        const seed = (data?.preferences as { avatar_seed?: string } | null)?.avatar_seed;
        if (seed) setAvatarSeed(seed);
        if (data?.display_name) setDisplayName(data.display_name);
      } catch {
        // ignore
      }
    }

    void loadProfileFields();
  }, [user?.id, location.pathname]);

  useEffect(() => {
    function onProfileUpdated(e: Event) {
      const detail = (e as CustomEvent<ProfileUpdateDetail>).detail;
      if (detail?.avatarSeed) setAvatarSeed(detail.avatarSeed);
      if (detail?.displayName) setDisplayName(detail.displayName);
    }
    window.addEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
  }, []);

  const plan = usage?.plan ?? "free";
  const copilotLevel = usage
    ? getQuotaLevel(usage.copilot_calls_used, usage.copilot_calls_limit)
    : "ok";
  const quotaWarning = copilotLevel === "warning" || copilotLevel === "critical";

  const profileData = {
    name:
      displayName?.trim() ||
      user?.displayName?.trim() ||
      user?.email?.split("@")[0] ||
      "User",
    email: user?.email ?? "",
    avatarUrl: getUserAvatarUrl(
      { id: user?.id, preferences: avatarSeed ? { avatar_seed: avatarSeed } : null },
      user?.email
    ),
    subscription: plan,
  };

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <div className="theme-product-dark flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "w-64 flex flex-col z-50 border-r border-white/10 bg-[#0a0a0a]/95 backdrop-blur-md",
          "fixed inset-y-0 left-0",
          "lg:relative lg:z-10",
          "transform transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="px-4 py-4 border-b border-white/10 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg font-bold font-display text-white">AKARA</span>
              {quotaWarning && (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" aria-label="Quota warning" />
              )}
            </div>
            <ProfileDropdown data={profileData} onSignOut={signOut} />
          </div>
          <button
            className="lg:hidden p-1.5 rounded-lg text-white/50 hover:text-white shrink-0"
            onClick={closeSidebar}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          <AppLineSidebar onNavigate={closeSidebar} />
        </div>

        <div className="px-4 py-4 border-t border-white/10 space-y-2">
          {plan === "free" && (
            <GlowCTALink to="/upgrade" size="sm" className="w-full block" onClick={closeSidebar}>
              Upgrade to Pro →
            </GlowCTALink>
          )}
        </div>
      </aside>

      <div className="fixed bottom-0 inset-x-0 z-30 lg:hidden">
        <nav className="mx-3 mb-3 rounded-2xl bg-[#0a0a0a]/95 border border-white/10 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-around py-2">
            {APP_NAV_ITEMS.slice(0, 5).map(({ to, shortLabel, icon: Icon }) => {
              const isActive = location.pathname.startsWith(to);
              const glass = APP_NAV_GLASS[to] ?? { color: "blue" as const, icon: Icon };
              const NavIcon = glass.icon;
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex flex-col items-center gap-0.5 p-1.5 rounded-xl min-w-0 transition-colors",
                    isActive ? "text-[#03B3C3]" : "text-white/45"
                  )}
                >
                  <GlassIcon
                    decorative
                    size="sm"
                    color={glass.color}
                    icon={<NavIcon className="h-3.5 w-3.5" />}
                    label={shortLabel}
                    active={isActive}
                  />
                  <span className="text-[10px] font-medium">{shortLabel}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0a0a0a]/90 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-white/50 hover:text-white"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-lg font-bold font-display text-white flex-1">AKARA</span>
          <ProfileDropdown
            data={profileData}
            onSignOut={signOut}
            compact
            className="w-auto"
          />
        </header>

        <SystemBanner />
        <ImpersonationBanner />
        <MaintenanceOverlay />

        {usage && (
          <>
            <PastDueBanner usage={usage} />
            <TrialWarning usage={usage} />
            <UsageBanner usage={usage} />
          </>
        )}

        <main className="flex-1 relative overflow-auto mb-16 lg:mb-0">
          <DarkMeshBackground className="fixed inset-0 opacity-30 pointer-events-none" />
          <ErrorBoundary>
            <MobileNavProvider openNav={() => setSidebarOpen(true)}>
              <Outlet />
            </MobileNavProvider>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
