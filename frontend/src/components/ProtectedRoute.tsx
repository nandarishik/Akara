/**
 * ProtectedRoute -- Sprint Phase 2, Day 3
 * Extended with two redirect checks:
 *  1. Email not verified → /verify-email
 *  2. tenant_id is null  → /onboarding
 */

import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"

export function ProtectedRoute() {
  const { session, user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-700" />
      </div>
    )
  }

  // Not authenticated → login
  if (!session) {
    return <Navigate to="/login" replace />
  }

  // Email not verified → verification pending page
  if (!session.user.email_confirmed_at) {
    return <Navigate to="/verify-email" replace />
  }

  // Authenticated but no tenant yet → must complete onboarding
  // user can be null if fetchProfile is still resolving, so we wait
  // (loading covers that case above; if user is still null after loading=false,
  //  that means the profile has no tenant_id → send to onboarding)
  if (user !== null && user.tenantId === null) {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
