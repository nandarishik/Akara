import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import LineSidebar from "@/shared/effects/LineSidebar";
import { LINE_SIDEBAR_AKARA } from "@/shared/effects/presets";
import {
  APP_NAV_ITEMS,
  APP_NAV_SECONDARY,
  APP_NAV_SUPERADMIN,
  navLabelToPath,
  type AppNavItem,
} from "@/lib/appNav";
import { isSuperadmin } from "@/lib/auth-utils";
import { useAuth } from "@/features/auth/contexts/AuthContext";
import { useBilling } from "@/features/billing/hooks/useBilling";

type Props = {
  onNavigate?: () => void;
  className?: string;
};

function buildNavEntries(
  showSuperadmin: boolean,
  features: Record<string, boolean> | undefined
): { labels: string[]; paths: string[]; locked: boolean[] } {
  const primary: AppNavItem[] = APP_NAV_ITEMS;
  const secondary: AppNavItem[] = [...APP_NAV_SECONDARY];
  if (showSuperadmin) secondary.push(APP_NAV_SUPERADMIN);

  const labels: string[] = [];
  const paths: string[] = [];
  const locked: boolean[] = [];

  for (const item of [...primary, ...secondary]) {
    const isLocked = item.feature && features ? !features[item.feature as keyof typeof features] : false;
    labels.push(isLocked ? `${item.label} 🔒` : item.label);
    paths.push(item.to);
    locked.push(!!isLocked);
  }

  return { labels, paths, locked };
}

export default function AppLineSidebar({ onNavigate, className }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: usage } = useBilling();

  const { labels, paths, locked } = useMemo(
    () => buildNavEntries(isSuperadmin(user), usage?.features),
    [user, usage?.features]
  );

  const activeIndex = useMemo(() => {
    const idx = paths.findIndex((p) => location.pathname.startsWith(p));
    return idx >= 0 ? idx : null;
  }, [location.pathname, paths]);

  return (
    <LineSidebar
      {...LINE_SIDEBAR_AKARA}
      items={labels}
      activeIndex={activeIndex}
      className={className}
      onItemClick={(index, label) => {
        const cleanLabel = label.replace(" 🔒", "");
        if (locked[index]) return;
        const path = navLabelToPath(cleanLabel) ?? paths[index];
        if (path) {
          navigate(path);
          onNavigate?.();
        }
      }}
    />
  );
}
