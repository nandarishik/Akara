/**
 * ProtectedRoute -- Sprint Phase 2, Day 3
 * Extended with two redirect checks:
 *  1. Email not verified → /verify-email
 *  2. tenant_id is null  → /onboarding
 */

import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/features/auth/contexts/AuthContext"

export function ProtectedRoute() {
  const { session, user, loading } = useAuth()
  const location = useLocation()

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
  // Allow /onboarding itself to render (avoid redirect loop → blank page)
  if (!user?.tenantId && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
