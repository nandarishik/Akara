import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type AccentColor = "blue" | "green" | "amber" | "red" | "none";

interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  accent?: AccentColor;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

const ACCENT_BAR: Record<AccentColor, string> = {
  blue: "bg-accent",
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  none: "",
};

const PADDING = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

/**
 * SurfaceCard — FireAI light product card (white + soft border + shadow).
 */
export default function SurfaceCard({
  children,
  accent = "none",
  padding = "md",
  hover = false,
  className,
  ...props
}: SurfaceCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-surface-border bg-surface-card shadow-card",
        hover && "card-hover",
        PADDING[padding],
        className
      )}
      {...props}
    >
      {accent !== "none" && (
        <div
          className={cn(
            "absolute left-0 top-4 bottom-4 w-1 rounded-r-full",
            ACCENT_BAR[accent]
          )}
          aria-hidden
        />
      )}
      {accent !== "none" ? <div className="pl-3">{children}</div> : children}
    </div>
  );
}

export function SurfacePanel({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-surface-border bg-surface-raised p-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
