import { lazy, Suspense, useMemo } from "react";

import { DEFAULT_EFFECT_OPTIONS } from "./hyperspeedOptions";

const Hyperspeed = lazy(() => import("./Hyperspeed"));

/** Memoized default palette from React Bits — teal/cyan + magenta highway lights. */
export const LANDING_HYPERSPEED_OPTIONS = DEFAULT_EFFECT_OPTIONS;

type Props = {
  className?: string;
};

function usePrefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function HyperspeedBackground({ className = "" }: Props) {
  const effectOptions = useMemo(() => LANDING_HYPERSPEED_OPTIONS, []);
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return <div className={`absolute inset-0 bg-black ${className}`.trim()} aria-hidden />;
  }

  return (
    <div className={`absolute inset-0 ${className}`.trim()}>
      <Suspense fallback={<div className="absolute inset-0 bg-black" aria-hidden />}>
        <Hyperspeed effectOptions={effectOptions} />
      </Suspense>
    </div>
  );
}

export function HyperspeedHeroOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-black/45 to-black"
      aria-hidden
    />
  );
}
