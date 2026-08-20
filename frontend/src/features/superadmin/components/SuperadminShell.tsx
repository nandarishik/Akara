import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { NotFoundPage } from "@/features/auth/pages/NotFoundPage";

import { SudoGate } from "@/features/superadmin/components/SudoGate";
import { CommandPalette } from "@/features/superadmin/components/CommandPalette";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { checkSuperadminAccess, sa, type AtRiskResponse, type RevenueSummary } from "@/lib/api/superadmin";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  Building2,
  Users,
  Wallet,
  LineChart,
  Mail,
  LogOut,
  ClipboardList,
  Wrench,
  LayoutDashboard,
  Activity,
  Clock,
  Bot,
  Package,
  FileText,
  Scale,
} from "lucide-react";
import { GlassIcon } from "@/shared/effects/GlassIcon";
import DarkMeshBackground from "@/shared/effects/DarkMeshBackground";
import type { GlassIconColor } from "@/shared/effects/GlassIcons";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: GlassIconColor;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Home",
    items: [{ href: "/superadmin/overview", label: "Overview", icon: LayoutDashboard, color: "blue" }],
  },
  {
    label: "Customers",
    items: [
      { href: "/superadmin/tenants", label: "Tenants", icon: Building2, color: "blue" },
      { href: "/superadmin/users", label: "Users", icon: Users, color: "purple" },
      { href: "/superadmin/usage", label: "Usage", icon: Activity, color: "green" },
    ],
  },
  {
    label: "Commercial",
    items: [
      { href: "/superadmin/revenue", label: "Revenue", icon: LineChart, color: "green" },
      { href: "/superadmin/billing", label: "Billing", icon: Wallet, color: "green" },
      { href: "/superadmin/plans", label: "Plans & Limits", icon: Package, color: "green" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/superadmin/comms", label: "Comms", icon: Mail, color: "orange" },
      { href: "/superadmin/cron", label: "Cron", icon: Clock, color: "blue" },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/superadmin/audit", label: "Audit Log", icon: ClipboardList, color: "red" },
      { href: "/superadmin/settings", label: "System", icon: Wrench, color: "indigo" },
    ],
  },
  {
    label: "Product",
    items: [
      { href: "/superadmin/ai", label: "AI Briefing", icon: Bot, color: "purple" },
      { href: "/superadmin/content", label: "Content & Media", icon: FileText, color: "orange" },
      { href: "/superadmin/legal", label: "Legal & Changelog", icon: Scale, color: "indigo" },
    ],
  },
];

const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function SuperadminShell() {
  const { session, user, loading, signOut } = useAuth();
  const location = useLocation();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [attentionCount, setAttentionCount] = useState(0);

  useEffect(() => {
    if (!session) return;
    checkSuperadminAccess()
      .then(setAllowed)
      .catch(() => setAllowed(false));
  }, [session]);

  useEffect(() => {
    if (!session || allowed !== true) return;
    void Promise.all([
      sa.revenue(),
      sa.cronHealth(),
      sa.atRiskTenants(),
      sa.tenants({ limit: 200 }),
    ])
      .then(
        ([revenue, cron, atRisk, tenants]: [
          RevenueSummary,
          { tasks: Array<{ status: string | null }> },
          AtRiskResponse,
          { items: Array<{ copilot_limit: number; copilot_calls_this_month: number }> },
        ]) => {
          let count = 0;
          if ((cron.tasks || []).some((t) => t.status === "failed")) count++;
          if (revenue.churned_this_month > 0) count += revenue.churned_this_month;
          count +=
            atRisk.past_due.length + atRisk.no_import_14d.length + atRisk.no_login_14d.length;
          const highQuota = tenants.items.filter((t) => {
            if (t.copilot_limit <= 0 || t.copilot_limit === -1) return false;
            return (t.copilot_calls_this_month / t.copilot_limit) * 100 >= 80;
          }).length;
          count += highQuota;
          setAttentionCount(count);
        },
      )
      .catch(() => setAttentionCount(0));
  }, [session, allowed]);

  if (loading || (session && allowed === null)) {
    return (
      <div className="superadmin-surface flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sa-accent border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowed === false) {
    return <NotFoundPage />;
  }

  const activeItem =
    NAV_ITEMS.find((item) => location.pathname.startsWith(item.href)) ?? NAV_ITEMS[0];

  return (
    <div className="theme-product-dark superadmin-surface flex h-screen overflow-hidden">
      <CommandPalette />
      <aside className="flex w-14 shrink-0 flex-col border-r border-sa-border bg-sa-surface">
        <div className="flex h-14 items-center justify-center border-b border-sa-border">
          <span className="text-lg" title="AKARA Ops">
            ðŸ”®
          </span>
        </div>
        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-2">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                title={item.label}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-lg transition-colors",
                  active ? "bg-sa-accent/20" : "hover:bg-sa-raised"
                )}
              >
                <GlassIcon
                  decorative
                  size="sm"
                  color={item.color}
                  icon={<Icon className="h-3.5 w-3.5 text-white" />}
                  label={item.label}
                  active={active}
                />
                <span className="sr-only">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sa-border p-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-sa-muted hover:bg-sa-raised hover:text-sa-text"
            onClick={() => void signOut()}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-sa-border bg-sa-surface px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-sa-muted">Superadmin</p>
            <h1 className="text-sm font-semibold text-sa-text">{activeItem.label}</h1>
          </div>
          <div className="flex items-center gap-4">
            {attentionCount > 0 && (
              <Link
                to="/superadmin/overview"
                className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300"
              >
                <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                {attentionCount} needs attention
              </Link>
            )}
            <span className="hidden text-xs text-sa-muted sm:inline">âŒ˜K command palette</span>
            <span className="truncate text-sm text-sa-muted">{user?.email ?? session.user.email}</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 relative">
          <DarkMeshBackground className="fixed inset-0 opacity-20 pointer-events-none" />
          <div className="relative z-10">
            <SudoGate>
              <Outlet />
            </SudoGate>
          </div>
        </main>
      </div>
    </div>
  );
}

export { NAV_ITEMS };
