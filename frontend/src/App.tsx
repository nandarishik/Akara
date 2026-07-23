/**
 * AKARA App — Route tree (Phase 2, Day 2)
 *
 * Customer and admin pages are lazy-loaded. The superadmin route group includes
 * the temporary read-only Cost Diagnostics page at /superadmin/costs.
 */

import * as React from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "@/contexts/AuthContext"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AppShell } from "@/components/layout/AppShell"
import { SuperadminShell } from "@/components/admin/SuperadminShell"
import { Toaster } from "@/components/ui/toast"

// ─── Eager (very small, needed on every first load) ───────────────────────────
import { LoginPage } from "@/pages/LoginPage"
import { NotFoundPage } from "@/pages/NotFoundPage"

// ─── Lazy — customer bundles ──────────────────────────────────────────────────
const DashboardPage = React.lazy(() => import("@/pages/DashboardPage").then(m => ({ default: m.DashboardPage })))
const CopilotPage   = React.lazy(() => import("@/pages/CopilotPage").then(m => ({ default: m.CopilotPage })))
const DataPage      = React.lazy(() => import("@/pages/DataPage").then(m => ({ default: m.DataPage })))
const ReportsPage   = React.lazy(() => import("@/pages/ReportsPage").then(m => ({ default: m.ReportsPage })))
const SimulatorPage = React.lazy(() => import("@/pages/SimulatorPage").then(m => ({ default: m.SimulatorPage })))
const SettingsPage  = React.lazy(() => import("@/pages/SettingsPage").then(m => ({ default: m.SettingsPage })))

// ─── Lazy — legacy admin (will be replaced by superadmin panel on Day 8) ─────
const TenantsPage = React.lazy(() => import("@/pages/admin/TenantsPage").then(m => ({ default: m.TenantsPage })))
const UsersPage   = React.lazy(() => import("@/pages/admin/UsersPage").then(m => ({ default: m.UsersPage })))

// ─── Lazy — superadmin ────────────────────────────────────────────────────────
const SATenantsPage   = React.lazy(() => import("@/pages/admin/TenantsPage").then(m => ({ default: m.TenantsPage })))
const SAUsersPage     = React.lazy(() => import("@/pages/admin/UsersPage").then(m => ({ default: m.UsersPage })))
const CostDiagnostics = React.lazy(() => import("@/pages/admin/CostDiagnostics"))

// ─── Dev-only component gallery ───────────────────────────────────────────────
const ComponentGallery = React.lazy(() => import("@/pages/gallery/ComponentGallery"))

function RouteSpinner() {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center" aria-busy="true">
      <div className="h-8 w-8 rounded-full border-3 border-violet-600 border-t-transparent animate-spin" aria-label="Loading page" />
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

export default function App() {
  const isDev = import.meta.env.DEV

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster />
          <React.Suspense fallback={<RouteSpinner />}>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginPage />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/copilot" element={<CopilotPage />} />
                  <Route path="/data" element={<DataPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/simulator" element={<SimulatorPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/admin/tenants" element={<TenantsPage />} />
                  <Route path="/admin/users" element={<UsersPage />} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute />}>
                <Route path="/superadmin" element={<SuperadminShell />}>
                  <Route index element={<Navigate to="/superadmin/tenants" replace />} />
                  <Route path="tenants" element={<SATenantsPage />} />
                  <Route path="users" element={<SAUsersPage />} />
                  <Route path="costs" element={<CostDiagnostics />} />
                  <Route path="*" element={
                    <div className="text-sa-muted text-sm p-8">
                      This superadmin section is coming in Day 8.
                    </div>
                  } />
                </Route>
              </Route>

              {isDev && (
                <Route path="/gallery" element={<ComponentGallery />} />
              )}

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </React.Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
