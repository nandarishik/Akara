import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

const BASE = import.meta.env.VITE_API_BASE_URL as string;
const POLL_MS = 30_000;

export type CopilotStatus = {
  llm_available: boolean;
  primary_provider?: string | null;
  primary_provider_healthy?: boolean | null;
  fallback_active?: boolean | null;
  estimated_latency_ms?: number | null;
  last_successful_call?: string | null;
  dashboard_available?: boolean;
  reason?: string | null;
  retry_after_seconds?: number | null;
};

async function fetchStatus(): Promise<CopilotStatus | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  try {
    const res = await fetch(`${BASE}/copilot/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) {
      // DEV1 not merged yet — treat as available so UI remains usable with mocks off.
      return { llm_available: true, dashboard_available: true };
    }
    if (!res.ok) return { llm_available: false, dashboard_available: true, reason: `HTTP ${res.status}` };
    return (await res.json()) as CopilotStatus;
  } catch {
    return {
      llm_available: false,
      dashboard_available: true,
      reason: "Unable to reach AI status endpoint.",
    };
  }
}

export function useCopilotStatus() {
  const [status, setStatus] = useState<CopilotStatus | null>(null);

  const refresh = useCallback(async () => {
    const next = await fetchStatus();
    if (next) setStatus(next);
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { status, refresh, llmAvailable: status?.llm_available !== false };
}
