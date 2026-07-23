/**
 * AKARA Toast — UI Bible §1.5
 *
 * Built on top of the `sonner` library.
 * Re-exports a branded `toast` helper with AKARA styling.
 *
 * Setup in main.tsx:
 *   import { Toaster } from "@/components/ui/toast"
 *   <Toaster />
 *
 * Usage anywhere:
 *   import { toast } from "@/components/ui/toast"
 *   toast.success("Import complete — 4,231 rows loaded")
 *   toast.error("Something went wrong", { description: "Please try again" })
 *   toast.warning("80% of your monthly quota used")
 *   toast.info("Weekly debrief is ready")
 *   toast.loading("Uploading file…")
 */

import { Toaster as Sonner } from "sonner"
import { toast as sonnerToast } from "sonner"

// ── Branded Toaster ───────────────────────────────────────────────────────────

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      expand={false}
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        classNames: {
          toast:       "font-sans text-sm rounded-xl border border-surface-border shadow-card",
          title:       "font-semibold text-text-primary",
          description: "text-text-secondary mt-0.5",
          actionButton:"bg-brand text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-brand-light",
          cancelButton:"bg-surface-raised text-text-secondary rounded-lg px-3 py-1.5 text-xs font-semibold",
          success:     "!border-l-4 !border-l-success",
          error:       "!border-l-4 !border-l-danger",
          warning:     "!border-l-4 !border-l-warning",
          info:        "!border-l-4 !border-l-info",
        },
      }}
    />
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
    sonnerToast.success(message, opts),

  error: (message: string, opts?: ToastOptions) =>
    sonnerToast.error(message, opts),

  warning: (message: string, opts?: ToastOptions) =>
    sonnerToast.warning(message, opts),

  info: (message: string, opts?: ToastOptions) =>
    sonnerToast.info(message, opts),

  loading: (message: string, opts?: ToastOptions) =>
    sonnerToast.loading(message, opts),

  dismiss: (id?: string | number) =>
    sonnerToast.dismiss(id),

  promise: sonnerToast.promise,
}
