import { useEffect, useState } from "react"

import { AkaraButton } from "@/shared/ui/GradientButton"
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"

type DeleteAccountDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceName: string
  userEmail: string
  onConfirm: (confirmEmail: string) => Promise<void>
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  workspaceName,
  userEmail,
  onConfirm,
}: DeleteAccountDialogProps) {
  const [typedName, setTypedName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) {
      setTypedName("")
      setError("")
    }
  }, [open])

  const canConfirm =
    typedName.trim().toLowerCase() === workspaceName.trim().toLowerCase() && !loading

  async function handleDelete() {
    if (!canConfirm) return
    setLoading(true)
    setError("")
    try {
      await onConfirm(userEmail)
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deletion failed")
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <GlowSurfaceCard accent="red" className="w-full max-w-md space-y-4">
        <h3 className="font-semibold text-red-400">Delete workspace</h3>
        <p className="text-sm text-text-secondary">
          This schedules permanent deletion of <strong>{workspaceName}</strong> and all workspace
          data after the grace period. This cannot be undone.
        </p>
        <div className="space-y-2">
          <Label htmlFor="confirm-workspace-name">
            Type <span className="font-mono font-semibold">{workspaceName}</span> to confirm
          </Label>
          <Input
            id="confirm-workspace-name"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={workspaceName}
            disabled={loading}
            autoComplete="off"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <AkaraButton variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </AkaraButton>
          <AkaraButton size="sm" onClick={() => void handleDelete()} loading={loading} disabled={!canConfirm}>
            Delete permanently
          </AkaraButton>
        </div>
      </GlowSurfaceCard>
    </div>
  )
}
