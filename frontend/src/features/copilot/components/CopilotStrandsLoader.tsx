import { lazy, Suspense, useMemo } from "react";

import {
  STRANDS_COPILOT_COMPANION,
  STRANDS_COPILOT_INLINE,
  STRANDS_COPILOT_MINI,
} from "@/shared/effects/presets";
import { cn } from "@/lib/utils";

const Strands = lazy(() => import("@/shared/effects/Strands"));

type Variant = "hero" | "inline" | "companion";

type Props = {
  variant?: Variant;
  className?: string;
  /** Brighter pulse when Copilot is thinking */
  active?: boolean;
};

function usePrefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function StaticFallback({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-br from-[#7C3AED]/30 via-[#03B3C3]/40 to-[#D856BF]/30 animate-pulse",
        className
      )}
      aria-hidden
    />
  );
}

export default function CopilotStrandsLoader({
  variant = "hero",
  className,
  active = false,
}: Props) {
  const reduced = usePrefersReducedMotion();
  const props = useMemo(() => {
    if (variant === "companion") return STRANDS_COPILOT_COMPANION;
    if (variant === "inline") return STRANDS_COPILOT_INLINE;
    return STRANDS_COPILOT_MINI;
  }, [variant]);

  const sizeClass =
    variant === "companion"
      ? "h-[3.25rem] w-[3.25rem]"
      : variant === "inline"
        ? "h-16 w-48"
        : "h-32 w-full max-w-md mx-auto";

  const inner = reduced ? (
    <StaticFallback className={cn("absolute inset-0", sizeClass)} />
  ) : (
    <div className={cn("relative", sizeClass, className)} aria-hidden>
      <Suspense fallback={<StaticFallback className="absolute inset-0" />}>
        <Strands {...props} className="absolute inset-0" style={{ width: "100%", height: "100%" }} />
      </Suspense>
    </div>
  );

  if (variant !== "companion") {
    return inner;
  }

  return (
    <div
      className={cn(
        "relative shrink-0 self-end mb-0.5",
        active && "animate-pulse",
        className
      )}
      aria-hidden
      title="AKARA intelligence"
    >
      <div
        className={cn(
          "absolute -inset-1 rounded-full blur-md transition-opacity duration-500",
          active
            ? "opacity-90 bg-gradient-to-br from-[#7C3AED]/50 via-[#03B3C3]/40 to-[#D856BF]/50"
            : "opacity-60 bg-gradient-to-br from-[#7C3AED]/25 via-[#03B3C3]/20 to-[#D856BF]/25"
        )}
      />
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-[#0a0a0a]/90",
          active
            ? "border-[#03B3C3]/50 shadow-[0_0_24px_rgba(3,179,195,0.35)]"
            : "border-[#03B3C3]/25 shadow-[0_0_12px_rgba(124,58,237,0.2)]"
        )}
      >
        <div className="p-1">{inner}</div>
      </div>
    </div>
  );
}
