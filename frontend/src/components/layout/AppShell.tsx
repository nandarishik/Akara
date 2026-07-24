import { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isAdmin } from "@/lib/auth-utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useBilling } from "@/hooks/useBilling";
import { UsageBanner, PastDueBanner, TrialWarning } from "@/components/billing";
import { getQuotaLevel } from "@/lib/api/billing";
import {
  LayoutDashboard,
  MessageSquare,
  Upload,
  BarChart2,
  LogOut,
  TrendingUp,
  Menu,
  X,
  Building2,
  Users,
  AlertTriangle,
  Settings,
  CreditCard,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, shortLabel: "Home", feature: null as string | null },
  { to: "/copilot", label: "Copilot", icon: MessageSquare, shortLabel: "AI", feature: null },
  { to: "/data", label: "Data", icon: Upload, shortLabel: "Data", feature: null },
  { to: "/reports", label: "Reports", icon: BarChart2, shortLabel: "Reports", feature: null },
  { to: "/simulator", label: "Simulator", icon: TrendingUp, shortLabel: "Sim", feature: "simulator" },
];

const ADMIN_NAV_ITEMS = [
  { to: "/admin/tenants", label: "Tenants", icon: Building2 },
  { to: "/admin/users", label: "Users", icon: Users },
];

export function AppShell() {
  const { user, session, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: usage } = useBilling();

  const plan = usage?.plan ?? "free";
  const features = usage?.features;
  const copilotLevel = usage
    ? getQuotaLevel(usage.copilot_calls_used, usage.copilot_calls_limit)
    : "ok";
  const quotaWarning = copilotLevel === "warning" || copilotLevel === "critical";

  function closeSidebar() {
    setSidebarOpen(false);
  }

  const isAdminUser = isAdmin(user, session);
  const isCopilot = location.pathname.startsWith("/copilot");

  return (
    <div className="flex h-screen bg-[#FAFCFF]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "w-60 flex flex-col z-10",
          "bg-[#0A1628] border-r border-slate-800/50",
          "fixed inset-y-0 left-0 z-50",
          "lg:relative lg:z-10",
          "transform transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="px-5 py-5 border-b border-white/[0.06] flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">AKARA</span>
              {quotaWarning && (
                <div className="p-1 rounded-full bg-amber-500/20">
                  <AlertTriangle className="h-3 w-3 text-amber-400" />
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{user?.email}</p>
            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400 capitalize">
              {plan}
            </span>
          </div>
          <button
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white"
            onClick={closeSidebar}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon, feature }) => {
            const isActive = location.pathname.startsWith(to);
            const isLocked = feature && features && !features[feature as keyof typeof features];
            return (
              <Link
                key={to}
                to={to}
                onClick={closeSidebar}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-white/[0.08] text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]",
                  isLocked && "opacity-70"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {isLocked && <Lock className="h-3 w-3 text-slate-500" aria-label="Locked" />}
              </Link>
            );
          })}

          <div className="pt-3 mt-2 border-t border-white/[0.06] space-y-0.5">
            <Link
              to="/billing"
              onClick={closeSidebar}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
                location.pathname.startsWith("/billing")
                  ? "bg-white/[0.08] text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
              )}
            >
              <CreditCard className="h-4 w-4 shrink-0" />
              Billing
            </Link>
            <Link
              to="/settings"
              onClick={closeSidebar}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
                location.pathname.startsWith("/settings")
                  ? "bg-white/[0.08] text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
              )}
            >
              <Settings className="h-4 w-4 shrink-0" />
              Settings
            </Link>
            {plan === "free" && (
              <Link
                to="/upgrade"
                onClick={closeSidebar}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-[#42A5F5] hover:bg-[#42A5F5]/10"
              >
                Upgrade →
              </Link>
            )}
          </div>

          {isAdminUser && (
            <>
              <div className="pt-5 pb-1.5 px-3">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Admin</p>
              </div>
              {ADMIN_NAV_ITEMS.map(({ to, label, icon: Icon }) => {
                const isActive = location.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={closeSidebar}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
                      isActive
                        ? "bg-white/[0.08] text-white"
                        : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className="px-3 py-3 border-t border-white/[0.06]">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors w-full"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="fixed bottom-0 inset-x-0 z-30 lg:hidden">
        <nav className="mx-3 mb-3 rounded-2xl bg-white/95 backdrop-blur-lg border border-slate-200 shadow-lg">
          <div className="flex items-center justify-around py-2">
            {NAV_ITEMS.slice(0, 5).map(({ to, shortLabel, icon: Icon }) => {
              const isActive = location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex flex-col items-center gap-0.5 p-2 rounded-lg min-w-0 transition-colors",
                    isActive ? "text-[#1565C0]" : "text-slate-400"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-[10px] font-medium">{shortLabel}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-lg font-bold text-[#0A1628]">AKARA</span>
        </header>

        {usage && (
          <>
            <PastDueBanner usage={usage} />
            <TrialWarning usage={usage} />
            <UsageBanner usage={usage} />
          </>
        )}

        <main
          className={cn(
            "flex-1 relative",
            isCopilot ? "overflow-hidden" : "overflow-auto",
            "mb-16 lg:mb-0"
          )}
        >
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
