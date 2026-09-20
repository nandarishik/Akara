import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { UserPlus } from "lucide-react"

import { apiFetch } from "@/lib/api"
import { AkaraButton } from "@/shared/ui/GradientButton"
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"

type InviteMemberDialogProps = {
  disabled?: boolean
  onInvited?: () => void | Promise<void>
}

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"

export function InviteMemberDialog({ disabled = false, onInvited }: InviteMemberDialogProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"admin" | "user">("user")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit() {
    if (!email.trim() || disabled) return
    setSaving(true)
    setError("")
    try {
      await apiFetch("/team/invite", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), role }),
      })
      setEmail("")
      setRole("user")
      setOpen(false)
      await onInvited?.()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invite failed"
      if (msg.includes("API 402")) {
        navigate("/upgrade")
        return
      }
      setError(msg.replace(/^API \d+: /, ""))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <AkaraButton size="sm" onClick={() => setOpen(true)} disabled={disabled}>
        <UserPlus className="h-4 w-4 mr-1" />
        Invite teammate
      </AkaraButton>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <GlowSurfaceCard className="w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Invite teammate</h3>
              <button
                type="button"
                className="text-sm text-text-muted hover:text-text-primary"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-dialog-email">Email</Label>
                <Input
                  id="invite-dialog-email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-dialog-role">Role</Label>
                <select
                  id="invite-dialog-role"
                  className={SELECT_CLASS}
                  value={role}
                  onChange={(e) => setRole(e.target.value as "admin" | "user")}
                  disabled={saving}
                >
                  <option value="admin">Admin</option>
                  <option value="user">Viewer</option>
                </select>
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-end gap-2">
              <AkaraButton variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </AkaraButton>
              <AkaraButton size="sm" onClick={() => void handleSubmit()} loading={saving} disabled={!email.trim()}>
                Send invite
              </AkaraButton>
            </div>
          </GlowSurfaceCard>
        </div>
      )}
    </>
  )
}
