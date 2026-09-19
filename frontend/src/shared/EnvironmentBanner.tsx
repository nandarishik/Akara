/**
 * Non-production environment banner (Phase 3).
 * Hidden when VITE_ENVIRONMENT is unset or "production".
 * Does not replace SystemBanner / ImpersonationBanner.
 */

export function EnvironmentBanner() {
  const env = import.meta.env.VITE_ENVIRONMENT as string | undefined
  if (!env || env === "production") {
    return null
  }

  return (
    <div className="w-full bg-orange-500 text-white text-center text-xs py-1 font-mono z-50">
      {env.toUpperCase()} — Not production. Data is synthetic.
    </div>
  )
}
