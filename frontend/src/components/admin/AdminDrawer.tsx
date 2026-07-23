import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface AdminDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  width?: "sm" | "md" | "lg"
  className?: string
}

const WIDTH_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
} as const

export function AdminDrawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "lg",
  className,
}: AdminDrawerProps) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const closeButtonRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (!open) return

    const previousFocus = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key !== "Tab" || !panelRef.current) return

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = ""
      previousFocus?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-drawer-title"
        className={cn(
          "relative flex h-full w-full flex-col border-l border-sa-border bg-sa-surface shadow-2xl animate-slide-in-right",
          WIDTH_CLASSES[width],
          className
        )}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-sa-border px-6 py-4">
          <div>
            <h2
              id="admin-drawer-title"
              className="text-lg font-semibold text-sa-text"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-sa-muted">{description}</p>
            )}
          </div>
          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="icon"
            className="text-sa-muted hover:bg-sa-raised hover:text-sa-text"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 text-sa-text">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-sa-border px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
