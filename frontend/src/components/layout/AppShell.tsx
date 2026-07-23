import { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isAdmin } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  LayoutDashboard,
  MessageSquare,
  Upload,
  BarChart2,
  Settings,
  LogOut,
  TrendingUp,
  Menu,
  X,
  Building2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PastDueBanner,
  TrialWarning,
  UsageBanner,
} from "@/components/billing";
import { useBilling } from "@/hooks/useBilling";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/copilot", label: "Copilot", icon: MessageSquare },
  { to: "/data", label: "Data", icon: Upload },
  { to: "/reports", label: "Reports", icon: BarChart2 },
  { to: "/simulator", label: "Simulator", icon: TrendingUp },
  { to: "/settings", label: "Settings", icon: Settings },
];

const ADMIN_NAV_ITEMS = [
  { to: "/admin/tenants", label: "Tenants", icon: Building2 },
  { to: "/admin/users", label: "Users", icon: Users },
];

export function AppShell() {
  const { user, session, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function closeSidebar() {
    setSidebarOpen(false);
  }

  const admin = isAdmin(user, session);
  const isCopilot = location.pathname.startsWith("/copilot");
  const { data: usage } = useBilling();

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Mobile overlay — shown behind sidebar when open on small screens */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "w-64 bg-white border-r border-slate-200 flex flex-col",
          // Mobile: fixed positioned, slides in/out
          "fixed inset-y-0 left-0 z-50",
          // Desktop: part of normal flow
          "lg:relative lg:z-auto",
          "transform transition-transform duration-200 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Sidebar header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-xl font-bold text-slate-900">AKARA</span>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {user?.email}
            </p>
          </div>
          {/* Close button — mobile only */}
          <button
            className="lg:hidden ml-2 p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            onClick={closeSidebar}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={closeSidebar}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                location.pathname.startsWith(to)
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}

          {/* Admin-only section */}
          {admin && (
            <>
              <div className="pt-4 pb-1 px-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Admin
                </p>
              </div>
              {ADMIN_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={closeSidebar}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    location.pathname.startsWith(to)
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4 border-t border-slate-200">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-slate-600"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar — hamburger + brand */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-lg font-bold text-slate-900">AKARA</span>
        </header>

        {/* Page content — wrapped in ErrorBoundary */}
        <main
          className={cn(
            "flex flex-1 flex-col min-h-0",
            isCopilot ? "overflow-hidden" : "overflow-auto"
          )}
        >
          <ErrorBoundary>
            <div
              className={cn(
                "flex flex-col min-h-0",
                isCopilot ? "flex-1 overflow-hidden" : "min-h-full"
              )}
            >
              {usage && usage.plan_status === "past_due" && (
                <PastDueBanner usage={usage} />
              )}
              {usage && usage.plan_status === "trialing" && (
                <TrialWarning usage={usage} />
              )}
              {/* Full quota card breaks Copilot's fixed-height chat layout — show on other pages only */}
              {usage && !isCopilot && (
                <div className="shrink-0 px-4 pt-4 lg:px-6">
                  <UsageBanner usage={usage} />
                </div>
              )}
              <div
                className={cn(
                  isCopilot
                    ? "flex min-h-0 flex-1 flex-col overflow-hidden"
                    : "flex-1"
                )}
              >
                <Outlet />
              </div>
            </div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
