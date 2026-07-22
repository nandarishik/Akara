import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";

// Placeholder pages (built Days 8–10)
const Copilot = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Copilot — coming Day 8</h1>
  </div>
);
const Data = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Data — coming Day 9</h1>
  </div>
);
const Reports = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Reports — coming Day 10</h1>
  </div>
);
const Simulator = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Simulator — coming Day 10</h1>
  </div>
);
const SettingsPage = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Settings — coming Day 9</h1>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 2 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/copilot" element={<Copilot />} />
                <Route path="/data" element={<Data />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/simulator" element={<Simulator />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
