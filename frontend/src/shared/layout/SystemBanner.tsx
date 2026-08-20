import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

const BASE = import.meta.env.VITE_API_BASE_URL as string;

interface SystemSettings {
  maintenance_mode: boolean;
  signup_open: boolean;
  environment_banner?: string | null;
}

async function fetchSystemSettings(): Promise<SystemSettings> {
  const res = await fetch(`${BASE}/system/settings`);
  if (!res.ok) throw new Error("settings unavailable");
  return res.json();
}

export function SystemBanner() {
  const { data } = useQuery({
    queryKey: ["system-settings"],
    queryFn: fetchSystemSettings,
    staleTime: 5 * 60 * 1000,
  });

  const message = data?.environment_banner;
  if (!message) return null;

  return (
    <div className="bg-accent px-4 py-2 text-center text-sm text-white" role="status">
      {message}
    </div>
  );
}

export function MaintenanceOverlay() {
  const { data } = useQuery({
    queryKey: ["system-settings"],
    queryFn: fetchSystemSettings,
    staleTime: 60 * 1000,
  });

  if (!data?.maintenance_mode) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-canvas/95 p-6">
      <div className="max-w-md text-center">
        <h2 className="text-xl font-semibold text-text-primary">Scheduled maintenance</h2>
        <p className="mt-2 text-sm text-text-muted">
          AKARA is temporarily unavailable. Please try again shortly.
        </p>
        <Link to="/login" className="mt-4 inline-block text-sm text-accent underline">
          Return to login
        </Link>
      </div>
    </div>
  );
}
