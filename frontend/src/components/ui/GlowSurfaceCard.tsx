import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

import BorderGlow from "@/components/effects/BorderGlow";
import { BORDER_GLOW_CARD } from "@/components/effects/presets";

type AccentColor = "blue" | "green" | "amber" | "red" | "none";

export interface GlowSurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  accent?: AccentColor;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
  animated?: boolean;
}

const ACCENT_BAR: Record<AccentColor, string> = {
  blue: "bg-[#38bdf8]",
  green: "bg-emerald-400",
  amber: "bg-amber-400",
  red: "bg-red-400",
  none: "",
};

const PADDING = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

/**
 * Dark BorderGlow card — spec defaults (#120F17, purple/pink/cyan mesh).
 * Drop-in replacement for SurfaceCard across product pages.
 */
export default function GlowSurfaceCard({
  children,
  accent = "none",
  padding = "md",
  hover = false,
  animated = false,
  className,
  ...props
}: GlowSurfaceCardProps) {
  return (
    <BorderGlow
      {...BORDER_GLOW_CARD}
      animated={animated}
      className={cn("w-full", hover && "transition-transform hover:scale-[1.005]", className)}
    >
      <div
        className={cn(
          "relative text-white/90 [&_.text-text-primary]:text-white [&_.text-text-secondary]:text-white/70 [&_.text-text-muted]:text-white/50",
          PADDING[padding]
        )}
        {...props}
      >
        {accent !== "none" && (
          <div
            className={cn(
              "absolute left-0 top-4 bottom-4 w-1 rounded-r-full z-[2]",
              ACCENT_BAR[accent]
            )}
            aria-hidden
          />
        )}
        {accent !== "none" ? <div className="pl-3">{children}</div> : children}
      </div>
    </BorderGlow>
  );
}

export function GlowSurfacePanel({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <BorderGlow {...BORDER_GLOW_CARD} borderRadius={12} glowRadius={24} className={cn("w-full", className)}>
      <div className={cn("p-4 text-white/90", className)} {...props}>
        {children}
      </div>
    </BorderGlow>
  );
}

/** @deprecated Use GlowSurfaceCard — kept for gradual migration */
export { GlowSurfacePanel as SurfacePanel };
