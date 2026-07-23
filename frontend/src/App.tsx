import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { SuperadminShell } from "@/components/admin/SuperadminShell";
import { Toaster } from "@/components/ui/toast";

const LoginPage = lazy(() =>
  import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage }))
);
const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const CopilotPage = lazy(() =>
  import("@/pages/CopilotPage").then((m) => ({ default: m.CopilotPage }))
);
const DataPage = lazy(() =>
  import("@/pages/DataPage").then((m) => ({ default: m.DataPage }))
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);
const ReportsPage = lazy(() =>
  import("@/pages/ReportsPage").then((m) => ({ default: m.ReportsPage }))
);
const SimulatorPage = lazy(() =>
  import("@/pages/SimulatorPage").then((m) => ({ default: m.SimulatorPage }))
);
const NotFoundPage = lazy(() =>
  import("@/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage }))
);
const PrivacyPage = lazy(() =>
  import("@/pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage }))
);
const TermsPage = lazy(() =>
  import("@/pages/TermsPage").then((m) => ({ default: m.TermsPage }))
);
const TenantsPage = lazy(() =>
  import("@/pages/admin/TenantsPage").then((m) => ({ default: m.TenantsPage }))
);
const UsersPage = lazy(() =>
  import("@/pages/admin/UsersPage").then((m) => ({ default: m.UsersPage }))
);
const ComponentGallery = lazy(() => import("@/pages/gallery/ComponentGallery"));

function SuperadminPlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-sa-border bg-sa-surface/50 p-12 text-center">
      <p className="text-lg font-semibold text-sa-text">{title}</p>
      <p className="mt-2 text-sm text-sa-muted">
        Full implementation coming in later sprint days.
      </p>
    </div>
  );
}

function RouteSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface-bg">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
    </div>
  );
}

const isDev = import.meta.env.DEV;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster />
          <Suspense fallback={<RouteSpinner />}>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />

              {isDev && (
                <Route path="/gallery" element={<ComponentGallery />} />
              )}

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

                <Route path="/superadmin" element={<SuperadminShell />}>
                  <Route
                    index
                    element={<Navigate to="/superadmin/tenants" replace />}
                  />
                  <Route
                    path="tenants"
                    element={<SuperadminPlaceholder title="Tenants" />}
                  />
                  <Route
                    path="users"
                    element={<SuperadminPlaceholder title="Users" />}
                  />
                  <Route
                    path="billing"
                    element={<SuperadminPlaceholder title="Billing" />}
                  />
                  <Route
                    path="data"
                    element={<SuperadminPlaceholder title="Data" />}
                  />
                  <Route
                    path="ai"
                    element={<SuperadminPlaceholder title="AI / LLM" />}
                  />
                  <Route
                    path="analytics"
                    element={<SuperadminPlaceholder title="Analytics" />}
                  />
                  <Route
                    path="comms"
                    element={<SuperadminPlaceholder title="Comms" />}
                  />
                  <Route
                    path="security"
                    element={<SuperadminPlaceholder title="Security" />}
                  />
                  <Route
                    path="ops"
                    element={<SuperadminPlaceholder title="Ops / Jobs" />}
                  />
                  <Route
                    path="audit"
                    element={<SuperadminPlaceholder title="Audit Log" />}
                  />
                  <Route
                    path="settings"
                    element={<SuperadminPlaceholder title="Settings" />}
                  />
                </Route>
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
