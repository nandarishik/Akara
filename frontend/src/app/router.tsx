/**
 * AKARA App Router — Route tree
 *
 * Route URLs are unchanged from the pre-FSD App.tsx tree.
 */

import * as React from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute"
import { AppShell } from "@/shared/layout/AppShell"
import { SuperadminShell } from "@/features/superadmin/components/SuperadminShell"
import PageLoader from "@/shared/ui/PageLoader"

// Eager (very small, needed on every first load)
import { LoginPage } from "@/features/auth/pages/LoginPage"
import { NotFoundPage } from "@/features/auth/pages/NotFoundPage"

const ServerErrorPage = React.lazy(() =>
  import("@/features/auth/pages/ServerErrorPage").then((m) => ({ default: m.ServerErrorPage }))
)

// Lazy — public / auth / onboarding pages
const LandingPage = React.lazy(() =>
  import("@/features/landing/pages/LandingPage").then((m) => ({ default: m.LandingPage }))
)
const SignUpPage = React.lazy(() =>
  import("@/features/auth/pages/SignUpPage").then((m) => ({ default: m.SignUpPage }))
)
const SignUpClosedPage = React.lazy(() =>
  import("@/features/auth/pages/SignUpClosedPage").then((m) => ({ default: m.SignUpClosedPage }))
)
const EmailVerificationPending = React.lazy(() =>
  import("@/features/auth/pages/EmailVerificationPending").then((m) => ({
    default: m.EmailVerificationPending,
  }))
)
const OnboardingPage = React.lazy(() =>
  import("@/features/onboarding/pages/OnboardingPage").then((m) => ({ default: m.OnboardingPage }))
)
const ForgotPasswordPage = React.lazy(() =>
  import("@/features/auth/pages/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage }))
)
const ResetPasswordPage = React.lazy(() =>
  import("@/features/auth/pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage }))
)

// Lazy — customer bundles
const DashboardPage = React.lazy(() =>
  import("@/features/dashboard/pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
)
const CopilotPage = React.lazy(() =>
  import("@/features/copilot/pages/CopilotPage").then((m) => ({ default: m.CopilotPage }))
)
const DataPage = React.lazy(() =>
  import("@/features/data-import/pages/DataPage").then((m) => ({ default: m.DataPage }))
)
const ReportsPage = React.lazy(() =>
  import("@/features/reports/pages/ReportsPage").then((m) => ({ default: m.ReportsPage }))
)
const SimulatorPage = React.lazy(() =>
  import("@/features/simulator/pages/SimulatorPage").then((m) => ({ default: m.SimulatorPage }))
)
const DebriefPage = React.lazy(() =>
  import("@/features/debrief/pages/DebriefPage").then((m) => ({ default: m.DebriefPage }))
)
const SettingsPage = React.lazy(() =>
  import("@/features/settings/pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
)
const SettingsTeamPage = React.lazy(() =>
  import("@/features/settings/pages/SettingsPage").then((m) => ({ default: m.SettingsTeamPage }))
)
const UpgradePage = React.lazy(() =>
  import("@/features/billing/pages/UpgradePage").then((m) => ({ default: m.UpgradePage }))
)
const BillingPage = React.lazy(() =>
  import("@/features/billing/pages/BillingPage").then((m) => ({ default: m.BillingPage }))
)
const AlertsPage = React.lazy(() =>
  import("@/features/alerts/pages/AlertsPage").then((m) => ({ default: m.AlertsPage }))
)
const PrivacyPage = React.lazy(() =>
  import("@/features/legal/pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage }))
)
const TermsPage = React.lazy(() =>
  import("@/features/legal/pages/TermsPage").then((m) => ({ default: m.TermsPage }))
)

// Lazy — superadmin
const OverviewPage = React.lazy(() =>
  import("@/features/superadmin/pages/OverviewPage").then((m) => ({ default: m.OverviewPage }))
)
const UsagePage = React.lazy(() =>
  import("@/features/superadmin/pages/UsagePage").then((m) => ({ default: m.UsagePage }))
)
const CronPage = React.lazy(() =>
  import("@/features/superadmin/pages/CronPage").then((m) => ({ default: m.CronPage }))
)
const SATenantsPage = React.lazy(() =>
  import("@/features/superadmin/pages/TenantsPage").then((m) => ({ default: m.TenantsPage }))
)
const SAUsersPage = React.lazy(() =>
  import("@/features/superadmin/pages/UsersPage").then((m) => ({ default: m.UsersPage }))
)
const BillingOpsPage = React.lazy(() =>
  import("@/features/superadmin/pages/BillingOpsPage").then((m) => ({ default: m.BillingOpsPage }))
)
const SuperadminAuditPage = React.lazy(() =>
  import("@/features/superadmin/pages/AuditPage").then((m) => ({ default: m.SuperadminAuditPage }))
)
const SuperadminCommsPage = React.lazy(() =>
  import("@/features/superadmin/pages/CommsPage").then((m) => ({ default: m.SuperadminCommsPage }))
)
const SuperadminAnalyticsPage = React.lazy(() =>
  import("@/features/superadmin/pages/AnalyticsPage").then((m) => ({
    default: m.SuperadminAnalyticsPage,
  }))
)
const SuperadminSettingsPage = React.lazy(() =>
  import("@/features/superadmin/pages/SettingsPage").then((m) => ({
    default: m.SuperadminSettingsPage,
  }))
)
const SuperadminAiPage = React.lazy(() =>
  import("@/features/superadmin/pages/AiPage").then((m) => ({ default: m.SuperadminAiPage }))
)
const ControlPlanePage = React.lazy(() =>
  import("@/features/superadmin/pages/ControlPlanePage").then((m) => ({ default: m.ControlPlanePage }))
)
const PlansPage = React.lazy(() =>
  import("@/features/superadmin/pages/PlansPage").then((m) => ({ default: m.PlansPage }))
)
const ContentPage = React.lazy(() =>
  import("@/features/superadmin/pages/ContentPage").then((m) => ({ default: m.ContentPage }))
)
const LegalPage = React.lazy(() =>
  import("@/features/superadmin/pages/LegalPage").then((m) => ({ default: m.LegalPage }))
)

// Dev-only component gallery
const ComponentGallery = React.lazy(() => import("@/pages/gallery/ComponentGallery"))

export function AppRouter() {
  const isDev = import.meta.env.DEV

  return (
    <BrowserRouter>
      <React.Suspense fallback={<PageLoader title="Loading AKARA…" subtitle="" />}>
        <Routes>
          {/* Public — landing, auth, onboarding */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/signup-closed" element={<SignUpClosedPage />} />
          <Route path="/verify-email" element={<EmailVerificationPending />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/500" element={<ServerErrorPage />} />
          <Route path="/upgrade" element={<UpgradePage />} />

          {/* Onboarding (session required, no AppShell) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Route>

          {/* Protected customer app */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/copilot" element={<CopilotPage />} />
              <Route path="/data" element={<DataPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/debrief" element={<DebriefPage />} />
              <Route path="/simulator" element={<SimulatorPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/team" element={<SettingsTeamPage />} />
              <Route path="/billing" element={<BillingPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/admin/tenants" element={<Navigate to="/superadmin/tenants" replace />} />
              <Route path="/admin/users" element={<Navigate to="/superadmin/users" replace />} />
            </Route>
          </Route>

          {/* Superadmin panel */}
          <Route element={<ProtectedRoute />}>
            <Route path="/superadmin" element={<SuperadminShell />}>
              <Route index element={<Navigate to="/superadmin/overview" replace />} />
              <Route path="overview" element={<OverviewPage />} />
              <Route path="tenants" element={<SATenantsPage />} />
              <Route path="users" element={<SAUsersPage />} />
              <Route path="usage" element={<UsagePage />} />
              <Route path="revenue" element={<SuperadminAnalyticsPage />} />
              <Route path="analytics" element={<Navigate to="/superadmin/revenue" replace />} />
              <Route path="billing" element={<BillingOpsPage />} />
              <Route path="plans" element={<PlansPage />} />
              <Route path="content" element={<ContentPage />} />
              <Route path="legal" element={<LegalPage />} />
              <Route path="comms" element={<SuperadminCommsPage />} />
              <Route path="cron" element={<CronPage />} />
              <Route path="audit" element={<SuperadminAuditPage />} />
              <Route path="settings" element={<SuperadminSettingsPage />} />
              <Route path="ai" element={<SuperadminAiPage />} />
              <Route path="control-plane" element={<ControlPlanePage />} />
              <Route path="data-studio" element={<ControlPlanePage defaultTab="studio" />} />
              <Route path="query-console" element={<ControlPlanePage defaultTab="query" />} />
              <Route path="runbooks" element={<ControlPlanePage defaultTab="runbooks" />} />
              <Route path="ai-control" element={<ControlPlanePage defaultTab="ai" />} />
              <Route path="templates" element={<ControlPlanePage defaultTab="templates" />} />
              <Route path="costs" element={<Navigate to="/superadmin/revenue" replace />} />
              <Route path="ops" element={<Navigate to="/superadmin/settings" replace />} />
            </Route>
          </Route>

          {/* Dev-only gallery */}
          {isDev && <Route path="/gallery" element={<ComponentGallery />} />}

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  )
}
