import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/toast";

const BASE = import.meta.env.VITE_API_BASE_URL as string;

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 429) {
      toast.error("Too many requests — please wait a minute and try again.");
    }
    throw new Error(`API ${res.status}: ${errorText}`);
  }
  return res.json() as Promise<T>;
}
