import { supabase } from "@/lib/supabase";

const BASE = import.meta.env.VITE_API_BASE_URL as string;

function csrfFromCookie(): string {
  const match = document.cookie.match(/(?:^|;\s*)akara_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function superadminFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const method = (options.method || "GET").toUpperCase();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(options.headers as Record<string, string> | undefined),
  };
  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    const csrf = csrfFromCookie();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface SudoStatus {
  active: boolean;
  expires_at: string | null;
}

export async function getSudoStatus(): Promise<SudoStatus> {
  return superadminFetch<SudoStatus>("/superadmin/sudo");
}

export async function startSudo(password: string): Promise<{ expires_at: string; csrf_token: string }> {
  return superadminFetch("/superadmin/sudo", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function checkSuperadminAccess(): Promise<boolean> {
  try {
    await getSudoStatus();
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("404")) return false;
    throw e;
  }
}
