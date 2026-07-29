import { lazy, Suspense, useMemo } from "react";

import { STRANDS_COPILOT_INLINE, STRANDS_COPILOT_MINI } from "@/components/effects/presets";
import { cn } from "@/lib/utils";

const Strands = lazy(() => import("@/components/effects/Strands"));

type Variant = "hero" | "inline";

type Props = {
  variant?: Variant;
  className?: string;
};

function usePrefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function StaticFallback({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl bg-gradient-to-r from-[#D856BF]/20 via-[#03B3C3]/25 to-[#0E5EA5]/20 animate-pulse",
        className
      )}
      aria-hidden
    />
  );
}

export default function CopilotStrandsLoader({ variant = "hero", className }: Props) {
  const reduced = usePrefersReducedMotion();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const props = useMemo(
    () => (variant === "inline" ? STRANDS_COPILOT_INLINE : STRANDS_COPILOT_MINI),
    [variant]
  );

  const sizeClass =
    variant === "inline" ? "h-16 w-48" : "h-32 w-full max-w-md mx-auto";

  if (reduced || isMobile) {
    return <StaticFallback className={cn(sizeClass, className)} />;
  }

  return (
    <div className={cn("relative", sizeClass, className)} aria-hidden>
      <Suspense fallback={<StaticFallback className="absolute inset-0" />}>
        <Strands {...props} className="absolute inset-0" style={{ width: "100%", height: "100%" }} />
      </Suspense>
    </div>
  );
}
