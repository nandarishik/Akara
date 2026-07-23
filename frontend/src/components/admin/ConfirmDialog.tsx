import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  confirmPhrase?: string
  impactPreview?: React.ReactNode
  loading?: boolean
  destructive?: boolean
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmPhrase = "CONFIRM",
  impactPreview,
  loading = false,
  destructive = true,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = React.useState("")
  const canConfirm =
    typed.trim().toUpperCase() === confirmPhrase.toUpperCase() && !loading

  React.useEffect(() => {
    if (!open) setTyped("")
  }, [open])

  async function handleConfirm() {
    if (!canConfirm) return
    await onConfirm()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-sa-border bg-sa-surface text-sa-text sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sa-text">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-sa-muted">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {impactPreview && (
          <div
            className={cn(
              "rounded-lg border border-sa-border bg-sa-raised/50 p-4 text-sm text-sa-text"
            )}
            data-testid="impact-preview"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-sa-muted">
              Impact preview
            </p>
            {impactPreview}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="confirm-phrase" className="text-sa-text">
            Type{" "}
            <span className="font-mono font-semibold text-sa-accent">
              {confirmPhrase}
            </span>{" "}
            to proceed
          </Label>
          <Input
            id="confirm-phrase"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmPhrase}
            className="border-sa-border bg-sa-bg text-sa-text placeholder:text-sa-muted focus-visible:ring-sa-accent/30"
            autoComplete="off"
            disabled={loading}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={loading}
            className="border-sa-border bg-sa-raised text-sa-text hover:bg-sa-border"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "primary"}
            loading={loading}
            disabled={!canConfirm}
            onClick={(e) => {
              e.preventDefault()
              void handleConfirm()
            }}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
