import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import AnimatedNumber from "./AnimatedNumber";
import { GlassIcon } from "@/shared/effects/GlassIcon";
import type { GlassIconColor } from "@/shared/effects/GlassIcons";
import { createStagger } from "@/lib/springs";

interface GlowKPICardProps {
  title: string;
  value: number;
  change?: {
    value: number;
    percentage: number;
    period?: string;
  };
  icon?: ReactNode;
  iconColor?: GlassIconColor;
  format?: {
    style?: "decimal" | "currency" | "percent";
    currency?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  };
  formatter?: (value: number) => string;
  loading?: boolean;
  staggerIndex?: number;
  className?: string;
  onClick?: () => void;
}

function DeltaBadge({
  change,
  className,
}: {
  change: NonNullable<GlowKPICardProps["change"]>;
  className?: string;
}) {
  const isPositive = change.percentage > 0;
  const isNeutral = change.percentage === 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
        isPositive && "bg-green-50 text-green-700",
        isNeutral && "bg-surface-raised text-text-muted",
        !isPositive && !isNeutral && "bg-red-50 text-red-700",
        className
      )}
    >
      <span>{isPositive ? "↗" : isNeutral ? "→" : "↘"}</span>
      <span>
        {isPositive ? "+" : ""}
        {change.percentage.toFixed(1)}%
      </span>
      {change.period && (
        <span className="text-text-muted font-normal">{change.period}</span>
      )}
    </span>
  );
}

export default function GlowKPICard({
  title,
  value,
  change,
  icon,
  iconColor = "blue",
  format,
  formatter,
  loading = false,
  staggerIndex = 0,
  className,
  onClick,
}: GlowKPICardProps) {
  if (loading) {
    return (
      <GlowSurfaceCard accent="blue" className={className}>
        <div className="space-y-3">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-8 w-32" />
          <div className="skeleton h-5 w-16" />
        </div>
      </GlowSurfaceCard>
    );
  }

  return (
    <GlowSurfaceCard
      accent="blue"
      hover={!!onClick}
      className={cn(onClick && "cursor-pointer", className)}
      onClick={onClick}
      style={createStagger(staggerIndex)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-caption uppercase tracking-wide">{title}</p>
        {icon && (
          <GlassIcon
            decorative
            size="md"
            color={iconColor}
            icon={<span className="glass-icon-slot-inner">{icon}</span>}
            label={title}
          />
        )}
      </div>
      <div className="mt-3 space-y-2">
        <AnimatedNumber
          value={value}
          format={format}
          formatter={formatter}
          delay={staggerIndex * 150 + 200}
          className="kpi-value"
        />
        {change && <DeltaBadge change={change} />}
      </div>
    </GlowSurfaceCard>
  );
}

export function KPIGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function RevenueKPICard(props: Omit<GlowKPICardProps, "format" | "icon">) {
  return (
    <GlowKPICard
      {...props}
      format={{ style: "currency", currency: "INR", maximumFractionDigits: 0 }}
    />
  );
}

export function CountKPICard(props: Omit<GlowKPICardProps, "format">) {
  return (
    <GlowKPICard
      {...props}
      format={{ style: "decimal", maximumFractionDigits: 0 }}
    />
  );
}

export function PercentageKPICard(props: Omit<GlowKPICardProps, "format">) {
  return (
    <GlowKPICard
      {...props}
      format={{ style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }}
    />
  );
}
