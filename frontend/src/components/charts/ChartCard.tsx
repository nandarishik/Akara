import type { ReactNode } from "react";

import GlowSurfaceCard from "@/components/ui/GlowSurfaceCard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  description?: string;
  badge?: string;
  children: ReactNode;
  className?: string;
  height?: number | string;
  padding?: "sm" | "md" | "lg";
}

export function ChartCard({
  title,
  description,
  badge,
  children,
  className,
  height = 280,
  padding = "md",
}: ChartCardProps) {
  return (
    <GlowSurfaceCard padding={padding} className={cn("overflow-hidden", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-text-muted">{description}</p>
          ) : null}
        </div>
        {badge ? (
          <Badge variant="outline" className="shrink-0 text-caption">
            {badge}
          </Badge>
        ) : null}
      </div>
      <div style={{ height: typeof height === "number" ? `${height}px` : height }}>{children}</div>
    </GlowSurfaceCard>
  );
}
