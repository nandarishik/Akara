import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  MessageSquare,
  Upload,
  BarChart2,
  BarChart3,
  TrendingUp,
  Bell,
  Settings,
  CreditCard,
  Shield,
} from "lucide-react";

export type AppNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  shortLabel: string;
  feature: string | null;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, shortLabel: "Home", feature: null },
  { to: "/copilot", label: "Copilot", icon: MessageSquare, shortLabel: "AI", feature: null },
  { to: "/data", label: "Data", icon: Upload, shortLabel: "Data", feature: null },
  { to: "/reports", label: "Reports", icon: BarChart2, shortLabel: "Reports", feature: null },
  { to: "/debrief", label: "Debrief", icon: BarChart3, shortLabel: "Debrief", feature: null },
  { to: "/alerts", label: "Alerts", icon: Bell, shortLabel: "Alerts", feature: "alerts" },
  { to: "/simulator", label: "Simulator", icon: TrendingUp, shortLabel: "Sim", feature: "simulator" },
];

export const APP_NAV_SECONDARY: AppNavItem[] = [
  { to: "/billing", label: "Billing", icon: CreditCard, shortLabel: "Bill", feature: null },
  { to: "/settings", label: "Settings", icon: Settings, shortLabel: "Set", feature: null },
];

export const APP_NAV_SUPERADMIN: AppNavItem = {
  to: "/superadmin",
  label: "Superadmin",
  icon: Shield,
  shortLabel: "Admin",
  feature: null,
};

export function navLabelToPath(label: string): string | undefined {
  const all = [...APP_NAV_ITEMS, ...APP_NAV_SECONDARY, APP_NAV_SUPERADMIN];
  return all.find((n) => n.label === label)?.to;
}
