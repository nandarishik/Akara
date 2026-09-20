/**
 * InviteAcceptPage — Phase 4 team invite email link handler.
 * Public route; session optional. Six UI states: loading, preview, need_login,
 * joining, success, error_410.
 */

import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "@/features/auth/contexts/AuthContext"
import { apiFetch } from "@/lib/api"
import {
  clearInviteToken,
  persistInviteTokenFromSearch,
} from "@/lib/teamInvite"
import { AuthLayout } from "@/shared/layout/AuthLayout"
import { AkaraButton } from "@/shared/ui/GradientButton"
import PageLoader from "@/shared/ui/PageLoader"
import { Badge } from "@/shared/ui/badge"

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ""

type InvitePreview = {
  email: string
  role: string
  workspace_name: string
  invited_by_name: string
  token?: string
}

type PageState =
  | "loading"
  | "preview"
  | "need_login"
  | "joining"
  | "success"
  | "error_410"

function roleDisplay(role: string): string {
  if (role === "admin") return "Admin"
  if (role === "owner") return "Owner"
  return "Viewer"
}

function inviteReturnQuery(token: string): string {
  const params = new URLSearchParams({ redirect: "/invite/accept", token })
  return params.toString()
}

export function InviteAcceptPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { session, user, signOut, refreshProfile } = useAuth()

  const [state, setState] = useState<PageState>("loading")
  const [invite, setInvite] = useState<InvitePreview | null>(null)
  const [error, setError] = useState("")

  const token =
    persistInviteTokenFromSearch(searchParams.toString()) ??
    searchParams.get("token") ??
    ""

  useEffect(() => {
    if (!token) {
      setState("error_410")
      return
    }

    let cancelled = false

    async function loadPreview() {
      setState("loading")
      try {
        const res = await fetch(
          `${API_BASE}/team/invite/accept?token=${encodeURIComponent(token)}`,
        )
        if (res.status === 410) {
          if (!cancelled) setState("error_410")
          return
        }
        if (!res.ok) {
          if (!cancelled) {
            setError("Could not load invite details.")
            setState("error_410")
          }
          return
        }
        const body = (await res.json()) as InvitePreview
        if (cancelled) return
        setInvite(body)
        if (!session) {
          setState("need_login")
        } else {
          setState("preview")
        }
      } catch {
        if (!cancelled) setState("error_410")
      }
    }

    void loadPreview()
    return () => {
      cancelled = true
    }
  }, [token, session])

  async function handleJoin() {
    if (!token) return
    setState("joining")
    setError("")
    try {
      await apiFetch<{ joined?: boolean; tenant_id: string }>("/team/invite/accept", {
        method: "POST",
        body: JSON.stringify({ token }),
      })
      clearInviteToken()
      await refreshProfile()
      setState("success")
      window.setTimeout(() => navigate("/dashboard", { replace: true }), 2000)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not join workspace"
      if (msg.includes("API 410")) {
        setState("error_410")
        return
      }
      setError(msg.includes("API 403") ? "This invite was sent to a different email address." : "Could not join workspace. Try again.")
      setState("preview")
    }
  }

  const sessionEmail = (session?.user?.email ?? user?.email ?? "").toLowerCase()
  const inviteEmail = (invite?.email ?? "").toLowerCase()
  const emailMatches = Boolean(sessionEmail && inviteEmail && sessionEmail === inviteEmail)

  if (state === "loading") {
    return (
      <AuthLayout title="Team invite">
        <PageLoader title="Loading invite…" subtitle="" minHeight="min-h-[120px]" />
      </AuthLayout>
    )
  }

  if (state === "error_410") {
    return (
      <AuthLayout title="Invite expired">
        <div className="space-y-4 text-center">
          <p className="text-sm text-text-secondary">
            This invite link has expired or is no longer valid. Ask your team admin to send a new
            invite.
          </p>
          <Link
            to="/login"
            className="btn-press inline-flex w-full items-center justify-center min-h-11 px-6 text-[15px] font-semibold rounded-full bg-accent text-white shadow-cta hover:bg-accent-hover"
          >
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    )
  }

  if (state === "success") {
    return (
      <AuthLayout title="Welcome aboard">
        <div className="space-y-3 text-center">
          <p className="text-sm text-emerald-400">
            You joined {invite?.workspace_name ?? "the workspace"}. Redirecting to your dashboard…
          </p>
        </div>
      </AuthLayout>
    )
  }

  if (!invite) {
    return (
      <AuthLayout title="Invite unavailable">
        <p className="text-sm text-red-400 text-center">{error || "Invite not found."}</p>
      </AuthLayout>
    )
  }

  const loginHref = `/login?${inviteReturnQuery(token)}`
  const signupHref = `/signup?email=${encodeURIComponent(invite.email)}&${inviteReturnQuery(token)}`

  return (
    <AuthLayout title="Join workspace">
      <div className="space-y-4">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2 text-sm">
          <p>
            <span className="text-text-muted">Workspace</span>
            <br />
            <span className="font-semibold text-text-primary">{invite.workspace_name}</span>
          </p>
          {invite.invited_by_name && (
            <p>
              <span className="text-text-muted">Invited by</span>
              <br />
              <span>{invite.invited_by_name}</span>
            </p>
          )}
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Role</span>
            <Badge variant="outline">{roleDisplay(invite.role)}</Badge>
          </div>
          <p>
            <span className="text-text-muted">Invite sent to</span>
            <br />
            <span>{invite.email}</span>
          </p>
        </div>

        {state === "need_login" && (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary text-center">
              Sign in or create an account with <strong>{invite.email}</strong> to accept this
              invite.
            </p>
            <Link
              to={loginHref}
              className="btn-press inline-flex w-full items-center justify-center min-h-11 px-6 text-[15px] font-semibold rounded-full bg-accent text-white shadow-cta hover:bg-accent-hover"
            >
              Sign in to accept
            </Link>
            <Link
              to={signupHref}
              className="btn-press inline-flex w-full items-center justify-center min-h-11 px-6 text-[15px] font-semibold rounded-full border-2 border-accent text-accent hover:bg-accent-soft"
            >
              Create account
            </Link>
          </div>
        )}

        {state === "preview" && session && !emailMatches && (
          <div className="space-y-3">
            <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 p-3 rounded-md">
              This invite was sent to {invite.email}. Sign in with that email to accept.
            </p>
            <AkaraButton
              variant="secondary"
              className="w-full"
              onClick={() => void signOut().then(() => navigate(loginHref))}
            >
              Sign out and use invited email
            </AkaraButton>
          </div>
        )}

        {state === "preview" && session && emailMatches && (
          <div className="space-y-3">
            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-md">
                {error}
              </p>
            )}
            <AkaraButton className="w-full" loading={false} onClick={() => void handleJoin()}>
              Join workspace
            </AkaraButton>
          </div>
        )}

        {state === "joining" && (
          <PageLoader title="Joining workspace…" subtitle="" minHeight="min-h-[80px]" />
        )}
      </div>
    </AuthLayout>
  )
}
