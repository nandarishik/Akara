/**
 * AKARA App — Route tree (Phase 2, Day 3)
 *
 * Changes vs Day 2:
 * - Wrapped in HelmetProvider (react-helmet-async) for per-page SEO
 * - CookieBanner rendered at root level (DPDP/GDPR)
 * - / now renders LandingPage instead of redirecting to /login
 * - Public routes: /signup, /verify-email, /forgot-password, /reset-password
 * - Semi-protected (session required, no AppShell) route: /onboarding
 * - All new pages are lazy-loaded
 */

import * as React from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
// import { HelmetProvider } from "react-helmet-async"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "@/contexts/AuthContext"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AppShell } from "@/components/layout/AppShell"
import { SuperadminShell } from "@/components/admin/SuperadminShell"
import { Toaster } from "@/components/ui/toast"
import { CookieBanner } from "@/components/CookieBanner"

// ─── Eager (very small, needed on every first load) ───────────────────────────
import { LoginPage } from "@/pages/LoginPage"
import { NotFoundPage } from "@/pages/NotFoundPage"

// ─── Lazy — public / auth / onboarding pages ──────────────────────────────────
const LandingPage             = React.lazy(() => import("@/pages/LandingPage").then(m => ({ default: m.LandingPage })))
const SignUpPage               = React.lazy(() => import("@/pages/SignUpPage").then(m => ({ default: m.SignUpPage })))
const SignUpClosedPage         = React.lazy(() => import("@/pages/SignUpClosedPage").then(m => ({ default: m.SignUpClosedPage })))
const EmailVerificationPending = React.lazy(() => import("@/pages/EmailVerificationPending").then(m => ({ default: m.EmailVerificationPending })))
const OnboardingPage           = React.lazy(() => import("@/pages/OnboardingPage").then(m => ({ default: m.OnboardingPage })))
const ForgotPasswordPage       = React.lazy(() => import("@/pages/ForgotPasswordPage").then(m => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage        = React.lazy(() => import("@/pages/ResetPasswordPage").then(m => ({ default: m.ResetPasswordPage })))

// ─── Lazy — customer bundles ──────────────────────────────────────────────────
const DashboardPage  = React.lazy(() => import("@/pages/DashboardPage").then(m => ({ default: m.DashboardPage })))
const CopilotPage    = React.lazy(() => import("@/pages/CopilotPage").then(m => ({ default: m.CopilotPage })))
const DataPage       = React.lazy(() => import("@/pages/DataPage").then(m => ({ default: m.DataPage })))
const ReportsPage    = React.lazy(() => import("@/pages/ReportsPage").then(m => ({ default: m.ReportsPage })))
const SimulatorPage  = React.lazy(() => import("@/pages/SimulatorPage").then(m => ({ default: m.SimulatorPage })))
const DebriefPage    = React.lazy(() => import("@/pages/DebriefPage").then(m => ({ default: m.DebriefPage })))
const SettingsPage   = React.lazy(() => import("@/pages/SettingsPage").then(m => ({ default: m.SettingsPage })))
const SettingsTeamPage = React.lazy(() => import("@/pages/SettingsPage").then(m => ({ default: m.SettingsTeamPage })))
const UpgradePage    = React.lazy(() => import("@/pages/UpgradePage").then(m => ({ default: m.UpgradePage })))
const BillingPage    = React.lazy(() => import("@/pages/BillingPage").then(m => ({ default: m.BillingPage })))
const AlertsPage     = React.lazy(() => import("@/pages/AlertsPage").then(m => ({ default: m.AlertsPage })))
const PrivacyPage    = React.lazy(() => import("@/pages/PrivacyPage").then(m => ({ default: m.PrivacyPage })))
const TermsPage      = React.lazy(() => import("@/pages/TermsPage").then(m => ({ default: m.TermsPage })))

// ─── Lazy — superadmin ────────────────────────────────────────────────────────
const SATenantsPage    = React.lazy(() => import("@/pages/admin/TenantsPage").then(m => ({ default: m.TenantsPage })))
const SAUsersPage      = React.lazy(() => import("@/pages/admin/UsersPage").then(m => ({ default: m.UsersPage })))
const CostDiagnostics  = React.lazy(() => import("@/pages/admin/CostDiagnostics"))
const BillingOpsPage   = React.lazy(() => import("@/pages/superadmin/BillingOpsPage").then(m => ({ default: m.BillingOpsPage })))
const SecurityOpsPage  = React.lazy(() => import("@/pages/superadmin/SecurityOpsPage").then(m => ({ default: m.SecurityOpsPage })))
const SuperadminDataPage = React.lazy(() => import("@/pages/superadmin/DataPage").then(m => ({ default: m.SuperadminDataPage })))
const SuperadminAuditPage = React.lazy(() => import("@/pages/superadmin/AuditPage").then(m => ({ default: m.SuperadminAuditPage })))
const SuperadminOpsPage = React.lazy(() => import("@/pages/superadmin/OpsPage").then(m => ({ default: m.SuperadminOpsPage })))
const SuperadminCommsPage = React.lazy(() => import("@/pages/superadmin/CommsPage").then(m => ({ default: m.SuperadminCommsPage })))
const SuperadminAnalyticsPage = React.lazy(() => import("@/pages/superadmin/AnalyticsPage").then(m => ({ default: m.SuperadminAnalyticsPage })))
const SuperadminSettingsPage = React.lazy(() => import("@/pages/superadmin/SettingsPage").then(m => ({ default: m.SuperadminSettingsPage })))
const SuperadminAiPage = React.lazy(() => import("@/pages/superadmin/AiPage").then(m => ({ default: m.SuperadminAiPage })))

// ─── Dev-only component gallery ───────────────────────────────────────────────
const ComponentGallery = React.lazy(() => import("@/pages/gallery/ComponentGallery"))

import PageLoader from "@/components/ui/PageLoader"

// ─── QueryClient ─────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 min
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const isDev = import.meta.env.DEV

  return (
    // <HelmetProvider>
    <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Toaster />
            <CookieBanner />
            <React.Suspense fallback={<PageLoader title="Loading AKARA…" subtitle="" />}>
              <Routes>
                {/* ── Public — landing, auth, onboarding ──────────── */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/signup" element={<SignUpPage />} />
                <Route path="/signup-closed" element={<SignUpClosedPage />} />
                <Route path="/verify-email" element={<EmailVerificationPending />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/upgrade" element={<UpgradePage />} />

                {/* ── Onboarding (session required, no AppShell) ─────── */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/onboarding" element={<OnboardingPage />} />
                </Route>

                {/* ── Protected customer app ──────────────────────────── */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppShell />}>
                    <Route path="/dashboard"  element={<DashboardPage />} />
                    <Route path="/copilot"    element={<CopilotPage />} />
                    <Route path="/data"       element={<DataPage />} />
                    <Route path="/reports"    element={<ReportsPage />} />
                    <Route path="/debrief"    element={<DebriefPage />} />
                    <Route path="/simulator"  element={<SimulatorPage />} />
                    <Route path="/settings"   element={<SettingsPage />} />
                    <Route path="/settings/team" element={<SettingsTeamPage />} />
                    <Route path="/billing"    element={<BillingPage />} />
                    <Route path="/alerts"    element={<AlertsPage />} />
                    <Route path="/admin/tenants" element={<Navigate to="/superadmin/tenants" replace />} />
                    <Route path="/admin/users" element={<Navigate to="/superadmin/users" replace />} />
                  </Route>
                </Route>

                {/* ── Superadmin panel ────────────────────────────────── */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/superadmin" element={<SuperadminShell />}>
                    <Route index element={<Navigate to="/superadmin/tenants" replace />} />
                    <Route path="tenants"   element={<SATenantsPage />} />
                    <Route path="users"     element={<SAUsersPage />} />
                    <Route path="costs"     element={<CostDiagnostics />} />
                    <Route path="billing"   element={<BillingOpsPage />} />
                    <Route path="security" element={<SecurityOpsPage />} />
                    <Route path="data"      element={<SuperadminDataPage />} />
                    <Route path="audit"     element={<SuperadminAuditPage />} />
                    <Route path="ops"       element={<SuperadminOpsPage />} />
                    <Route path="comms"     element={<SuperadminCommsPage />} />
                    <Route path="analytics" element={<SuperadminAnalyticsPage />} />
                    <Route path="settings"  element={<SuperadminSettingsPage />} />
                    <Route path="ai"        element={<SuperadminAiPage />} />
                  </Route>
                </Route>

                {/* ── Dev-only gallery ────────────────────────────────── */}
                {isDev && (
                  <Route path="/gallery" element={<ComponentGallery />} />
                )}

                {/* ── 404 ─────────────────────────────────────────────── */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </React.Suspense>
          </BrowserRouter>
        </AuthProvider>
    </QueryClientProvider>
    // </HelmetProvider>
  )
}
