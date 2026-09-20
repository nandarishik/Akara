import { supabase } from "@/lib/supabase";
import { toast } from "@/shared/ui/toast";

const BASE = import.meta.env.VITE_API_BASE_URL as string;

export type ApiErrorEvent =
  | { type: "session_expired" }
  | { type: "quota_exceeded"; upgrade_url: string }
  | { type: "plan_feature_blocked"; feature: string }
  | { type: "rate_limited"; retry_after: number }
  | { type: "role_forbidden"; message: string };

const apiErrorEmitter = new EventTarget();

export function onApiError(handler: (e: ApiErrorEvent) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<ApiErrorEvent>).detail);
  apiErrorEmitter.addEventListener("api_error", listener);
  return () => apiErrorEmitter.removeEventListener("api_error", listener);
}

function emitApiError(detail: ApiErrorEvent) {
  apiErrorEmitter.dispatchEvent(new CustomEvent("api_error", { detail }));
}

function parseDetail(errorText: string): Record<string, unknown> {
  try {
    const body = JSON.parse(errorText) as { detail?: unknown };
    if (body && typeof body.detail === "object" && body.detail !== null) {
      return body.detail as Record<string, unknown>;
    }
    if (typeof body.detail === "string") {
      return { message: body.detail, error: body.detail };
    }
    return body as Record<string, unknown>;
  } catch {
    return { message: errorText };
  }
}

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
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
    const detail = parseDetail(errorText);
    const errCode = String(detail.error ?? "");
    const message = String(detail.message ?? detail.error ?? errorText);

    if (res.status === 401) {
      emitApiError({ type: "session_expired" });
      toast.error("Session expired — please sign in again.");
    } else if (res.status === 402) {
      const upgradeUrl = String(detail.upgrade_url ?? "/upgrade");
      emitApiError({ type: "quota_exceeded", upgrade_url: upgradeUrl });
    } else if (res.status === 403) {
      if (errCode === "feature_not_available" || detail.feature) {
        emitApiError({
          type: "plan_feature_blocked",
          feature: String(detail.feature ?? "feature"),
        });
      } else {
        emitApiError({
          type: "role_forbidden",
          message:
            message.includes("does not have permission") || message
              ? "You don't have permission to do this. Contact your workspace owner."
              : "Contact your workspace owner.",
        });
      }
    } else if (res.status === 429) {
      const retryAfterHeader = res.headers.get("Retry-After");
      const retryAfter = Number(detail.retry_after ?? retryAfterHeader ?? 60);
      emitApiError({ type: "rate_limited", retry_after: retryAfter });
      toast.error(`Too many requests — try again in ${retryAfter}s.`);
    }
    throw new Error(`API ${res.status}: ${errorText}`);
  }
  return res.json() as Promise<T>;
}

export interface ImpersonationSessionResponse {
  active: boolean;
  reason: string | null;
  expires_at: string | null;
  session_id: string | null;
}
export async function fetchImpersonationSession(): Promise<ImpersonationSessionResponse> {
  return apiFetch("/account/impersonation-session");
}
