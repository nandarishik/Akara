import { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isAdmin } from "@/lib/auth-utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useBilling } from "@/hooks/useBilling";
import { UsageBanner, PastDueBanner, TrialWarning } from "@/components/billing";
import { AkaraButton } from "@/components/ui/GradientButton";
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
  Bell,
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
  { to: "/alerts", label: "Alerts", icon: Bell, shortLabel: "Alerts", feature: "alerts" },
  { to: "/simulator", label: "Simulator", icon: TrendingUp, shortLabel: "Sim", feature: "simulator" },
];

const ADMIN_NAV_ITEMS = [
  { to: "/admin/tenants", label: "Tenants", icon: Building2 },
  { to: "/admin/users", label: "Users", icon: Users },
];

const PLAN_BADGE: Record<string, string> = {
  free: "bg-surface-raised text-text-muted",
  pro: "bg-accent-soft text-accent",
  business: "bg-accent-soft text-accent-hover",
};

function NavLink({
  to,
  label,
  icon: Icon,
  isActive,
  isLocked,
  onClick,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  isLocked?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 text-[13px] font-medium transition-colors",
        isActive
          ? "bg-accent-soft text-accent rounded-full"
          : "text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-lg",
        isLocked && "opacity-70"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {isLocked && <Lock className="h-3 w-3 text-text-muted" aria-label="Locked" />}
    </Link>
  );
}

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
    <div className="flex h-screen bg-surface-canvas">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "w-60 flex flex-col z-10 bg-white border-r border-surface-border",
          "fixed inset-y-0 left-0 z-50",
          "lg:relative lg:z-10",
          "transform transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="px-5 py-5 border-b border-surface-border flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold font-display text-text-primary">AKARA</span>
              {quotaWarning && (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-label="Quota warning" />
              )}
            </div>
            <p className="text-caption mt-0.5 truncate">{user?.email}</p>
            <span
              className={cn(
                "inline-block mt-1.5 text-[10px] px-2.5 py-0.5 rounded-full font-medium capitalize",
                PLAN_BADGE[plan] ?? PLAN_BADGE.free
              )}
            >
              {plan}
            </span>
          </div>
          <button
            className="lg:hidden p-1.5 rounded-lg text-text-muted hover:text-text-primary"
            onClick={closeSidebar}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon, feature }) => {
            const isActive = location.pathname.startsWith(to);
            const isLocked = feature && features && !features[feature as keyof typeof features];
            return (
              <NavLink
                key={to}
                to={to}
                label={label}
                icon={icon}
                isActive={isActive}
                isLocked={!!isLocked}
                onClick={closeSidebar}
              />
            );
          })}

          <div className="pt-3 mt-2 border-t border-surface-border space-y-0.5">
            <NavLink
              to="/billing"
              label="Billing"
              icon={CreditCard}
              isActive={location.pathname.startsWith("/billing")}
              onClick={closeSidebar}
            />
            <NavLink
              to="/settings"
              label="Settings"
              icon={Settings}
              isActive={location.pathname.startsWith("/settings")}
              onClick={closeSidebar}
            />
          </div>

          {isAdminUser && (
            <>
              <div className="pt-5 pb-1.5 px-3">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Admin</p>
              </div>
              {ADMIN_NAV_ITEMS.map(({ to, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  label={label}
                  icon={icon}
                  isActive={location.pathname.startsWith(to)}
                  onClick={closeSidebar}
                />
              ))}
            </>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-surface-border space-y-2">
          {plan === "free" && (
            <Link to="/upgrade" onClick={closeSidebar} className="block">
              <AkaraButton size="sm" className="w-full">
                Upgrade to Pro
              </AkaraButton>
            </Link>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors w-full"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="fixed bottom-0 inset-x-0 z-30 lg:hidden">
        <nav className="mx-3 mb-3 rounded-2xl bg-white border border-surface-border shadow-card">
          <div className="flex items-center justify-around py-2">
            {NAV_ITEMS.slice(0, 5).map(({ to, shortLabel, icon: Icon }) => {
              const isActive = location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex flex-col items-center gap-0.5 p-2 rounded-full min-w-0 transition-colors",
                    isActive ? "text-accent bg-accent-soft" : "text-text-muted"
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
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-surface-border shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-lg font-bold font-display text-text-primary">AKARA</span>
        </header>

        {usage && !isCopilot && (
          <>
            <PastDueBanner usage={usage} />
            <TrialWarning usage={usage} />
            <UsageBanner usage={usage} />
          </>
        )}

        <main
          className={cn(
            "flex-1 relative bg-surface-canvas",
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
