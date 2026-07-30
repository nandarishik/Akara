import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  MessageSquare,
  Upload,
  BarChart2,
  BarChart3,
  Bell,
  TrendingUp,
  CreditCard,
  Settings,
  Shield,
  Building2,
  Users,
  Wallet,
  Radio,
  Database,
  LineChart,
  Bot,
  FileSearch,
  IndianRupee,
  ShoppingCart,
  Package,
  AlertTriangle,
  FileSpreadsheet,
  Sparkles,
} from "lucide-react";

import type { GlassIconColor } from "@/components/effects/GlassIcons";

export const APP_NAV_GLASS: Record<
  string,
  { color: GlassIconColor; icon: LucideIcon }
> = {
  "/dashboard": { color: "blue", icon: LayoutDashboard },
  "/copilot": { color: "purple", icon: MessageSquare },
  "/data": { color: "indigo", icon: Upload },
  "/reports": { color: "green", icon: BarChart2 },
  "/debrief": { color: "orange", icon: BarChart3 },
  "/alerts": { color: "red", icon: Bell },
  "/simulator": { color: "green", icon: TrendingUp },
  "/billing": { color: "blue", icon: CreditCard },
  "/settings": { color: "indigo", icon: Settings },
  "/superadmin": { color: "purple", icon: Shield },
};

export const SUPERADMIN_NAV_GLASS: Record<
  string,
  { color: GlassIconColor; icon: LucideIcon; label: string }
> = {
  "/superadmin/tenants": { color: "blue", icon: Building2, label: "Tenants" },
  "/superadmin/users": { color: "purple", icon: Users, label: "Users" },
  "/superadmin/billing": { color: "green", icon: Wallet, label: "Billing" },
  "/superadmin/comms": { color: "orange", icon: Radio, label: "Comms" },
  "/superadmin/usage": { color: "indigo", icon: Database, label: "Usage" },
  "/superadmin/revenue": { color: "green", icon: LineChart, label: "Revenue" },
  "/superadmin/overview": { color: "blue", icon: Sparkles, label: "Overview" },
  "/superadmin/ai": { color: "purple", icon: Bot, label: "AI" },
  "/superadmin/audit": { color: "red", icon: FileSearch, label: "Audit" },
  "/superadmin/settings": { color: "indigo", icon: Settings, label: "Settings" },
  "/superadmin": { color: "purple", icon: Shield, label: "Overview" },
};

export const DASHBOARD_KPI_GLASS: Record<string, GlassIconColor> = {
  revenue: "green",
  orders: "blue",
  parties: "purple",
  growth: "orange",
};

export const DEBRIEF_METRIC_GLASS: Record<string, GlassIconColor> = {
  revenue: "green",
  orders: "blue",
  month: "purple",
  wow: "orange",
};

export function kpiGlassColor(key: string): GlassIconColor {
  return DASHBOARD_KPI_GLASS[key] ?? "blue";
}

export const LANDING_FEATURE_GLASS = [
  { color: "blue" as const, icon: FileSpreadsheet, label: "Excel overload" },
  { color: "purple" as const, icon: MessageSquare, label: "Quick answers" },
  { color: "indigo" as const, icon: Bell, label: "Weekly brief" },
  { color: "green" as const, icon: BarChart2, label: "Zone analytics" },
  { color: "orange" as const, icon: Package, label: "SKU tracking" },
  { color: "red" as const, icon: AlertTriangle, label: "Scheme leakage" },
];

export const PLAN_GLASS_COLORS: GlassIconColor[] = ["blue", "purple", "green"];

export { IndianRupee, ShoppingCart, Package, TrendingUp };
