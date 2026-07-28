import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { NotFoundPage } from "@/pages/NotFoundPage";

import { SudoGate } from "@/components/admin/SudoGate";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { useAuth } from "@/contexts/AuthContext";
import { checkSuperadminAccess } from "@/lib/api/superadmin";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Users,
  Wallet,
  LineChart,
  Database,
  Shield,
  Bot,
  LogOut,
  Coins,
  Mail,
  Cog,
  ClipboardList,
  Wrench,
} from "lucide-react";
import { GlassIcon } from "@/components/effects/GlassIcon";
import type { GlassIconColor } from "@/components/effects/GlassIcons";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: GlassIconColor;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Customers",
    items: [
      { href: "/superadmin/tenants", label: "Tenants", icon: Building2, color: "blue" },
      { href: "/superadmin/users", label: "Users", icon: Users, color: "purple" },
    ],
  },
  {
    label: "Commercial",
    items: [
      { href: "/superadmin/billing", label: "Billing", icon: Wallet, color: "green" },
      { href: "/superadmin/costs", label: "Costs", icon: Coins, color: "orange" },
      { href: "/superadmin/analytics", label: "Analytics", icon: LineChart, color: "green" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/superadmin/data", label: "Data", icon: Database, color: "indigo" },
      { href: "/superadmin/security", label: "Security", icon: Shield, color: "red" },
      { href: "/superadmin/ops", label: "Ops / Jobs", icon: Cog, color: "blue" },
      { href: "/superadmin/comms", label: "Comms", icon: Mail, color: "orange" },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/superadmin/audit", label: "Audit Log", icon: ClipboardList, color: "red" },
      { href: "/superadmin/settings", label: "Settings", icon: Wrench, color: "indigo" },
    ],
  },
  {
    label: "Product",
    items: [{ href: "/superadmin/ai", label: "AI / LLM", icon: Bot, color: "purple" }],
  },
];

const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function SuperadminShell() {
  const { session, user, loading, signOut } = useAuth();
  const location = useLocation();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) return;
    checkSuperadminAccess()
      .then(setAllowed)
      .catch(() => setAllowed(false));
  }, [session]);

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
    <div className="superadmin-surface flex h-screen overflow-hidden">
      <CommandPalette />
      <aside className="flex w-14 shrink-0 flex-col border-r border-sa-border bg-sa-surface">
        <div className="flex h-14 items-center justify-center border-b border-sa-border">
          <span className="text-lg" title="AKARA Ops">
            🔮
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
            <span className="hidden text-xs text-sa-muted sm:inline">⌘K command palette</span>
            <span className="truncate text-sm text-sa-muted">{user?.email ?? session.user.email}</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <SudoGate>
            <Outlet />
          </SudoGate>
        </main>
      </div>
    </div>
  );
}

export { NAV_ITEMS };
