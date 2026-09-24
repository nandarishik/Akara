import { useEffect, useMemo, useState } from "react";
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
import { useConnectorsEnabled } from "@/features/connectors/hooks/useConnectorsEnabled";
import { getDataQuality } from "@/features/data-import/api/cafeImportApi";
import { fetchActionSummary } from "@/features/actions/api/actionsApi";

type Props = {
  onNavigate?: () => void;
  className?: string;
};

function buildNavEntries(
  showSuperadmin: boolean,
  features: Record<string, boolean> | undefined,
  quarantineCount: number,
  connectorsEnabled: boolean,
  actionsOpenCount: number,
): { labels: string[]; paths: string[]; locked: boolean[] } {
  const primary: AppNavItem[] = APP_NAV_ITEMS.filter(
    (item) => item.to !== "/connectors" || connectorsEnabled,
  );
  const secondary: AppNavItem[] = [...APP_NAV_SECONDARY];
  if (showSuperadmin) secondary.push(APP_NAV_SUPERADMIN);

  const labels: string[] = [];
  const paths: string[] = [];
  const locked: boolean[] = [];

  for (const item of [...primary, ...secondary]) {
    const isLocked =
      item.feature && features ? !features[item.feature as keyof typeof features] : false;
    let label = isLocked ? `${item.label} 🔒` : item.label;
    if (item.to === "/data" && quarantineCount > 0) {
      label = `${label} (${quarantineCount})`;
    }
    if (item.to === "/actions" && actionsOpenCount > 0) {
      label = `${label} (${actionsOpenCount})`;
    }
    labels.push(label);
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
  const { enabled: connectorsEnabled } = useConnectorsEnabled();
  const [quarantineCount, setQuarantineCount] = useState(0);
  const [actionsOpenCount, setActionsOpenCount] = useState(0);

  useEffect(() => {
    void getDataQuality()
      .then((q) => setQuarantineCount(q.quarantine_unresolved ?? 0))
      .catch(() => setQuarantineCount(0));
  }, [location.pathname]);

  useEffect(() => {
    void fetchActionSummary()
      .then((s) => setActionsOpenCount(s.open_count ?? 0))
      .catch(() => setActionsOpenCount(0));
    const timer = window.setInterval(() => {
      void fetchActionSummary()
        .then((s) => setActionsOpenCount(s.open_count ?? 0))
        .catch(() => setActionsOpenCount(0));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [location.pathname]);

  const { labels, paths, locked } = useMemo(
    () =>
      buildNavEntries(
        isSuperadmin(user),
        usage?.features,
        quarantineCount,
        connectorsEnabled,
        actionsOpenCount,
      ),
    [user, usage?.features, quarantineCount, connectorsEnabled, actionsOpenCount],
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
        const cleanLabel = label.replace(" 🔒", "").replace(/\s\(\d+\)$/, "");
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
