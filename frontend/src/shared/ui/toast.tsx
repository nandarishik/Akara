/**
 * AKARA Toast — UI Bible §1.5
 *
 * Built on top of the `sonner` library.
 * Re-exports a branded `toast` helper with AKARA styling.
 *
 * Setup in main.tsx:
 *   import { Toaster } from "@/shared/ui/toast"
 *   <Toaster />
 *
 * Usage anywhere:
 *   import { toast } from "@/shared/ui/toast"
 *   toast.success("Import complete — 4,231 rows loaded")
 *   toast.error("Something went wrong", { description: "Please try again" })
 *   toast.warning("80% of your monthly quota used")
 *   toast.info("Weekly debrief is ready")
 *   toast.loading("Uploading file…")
 */

// import { Toaster as Sonner } from "sonner"
// import { toast as sonnerToast } from "sonner"

// ── Branded Toaster ───────────────────────────────────────────────────────────

export function Toaster() {
  return (
    <div /> // Temporary fallback - will be restored once sonner is installed
  )
}

// ── Typed wrapper ─────────────────────────────────────────────────────────────

type ToastOptions = {
  description?: string
  duration?: number
  action?: { label: string; onClick: () => void }
}

export const toast = {
  success: (message: string, opts?: ToastOptions) =>
    console.log('🟢 Toast:', message, opts),

  error: (message: string, opts?: ToastOptions) =>
    console.error('🔴 Toast:', message, opts),

  warning: (message: string, opts?: ToastOptions) =>
    console.warn('🟡 Toast:', message, opts),

  info: (message: string, opts?: ToastOptions) =>
    console.info('🔵 Toast:', message, opts),

  loading: (message: string, opts?: ToastOptions): string | number => {
    console.log('⏳ Toast:', message, opts)
    return 'loading'
  },

  dismiss: (id?: string | number) =>
    console.log('❌ Dismiss toast:', id),

  promise: (promise: Promise<any>, _opts?: any) => promise,
}
