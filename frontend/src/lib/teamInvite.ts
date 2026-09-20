import { apiFetch } from "@/lib/api";

export const INVITE_TOKEN_KEY = "akara_team_invite_token";

/** Persist invite token from `?invite=` or `?token=` (Phase 4 email links). */
export function persistInviteTokenFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const token = (params.get("token") ?? params.get("invite"))?.trim();
  if (token) {
    sessionStorage.setItem(INVITE_TOKEN_KEY, token);
    return token;
  }
  return sessionStorage.getItem(INVITE_TOKEN_KEY);
}

export function clearInviteToken(): void {
  sessionStorage.removeItem(INVITE_TOKEN_KEY);
}

export async function acceptPendingInvite(): Promise<{ ok: boolean; tenantId?: string }> {
  const token = sessionStorage.getItem(INVITE_TOKEN_KEY);
  if (!token) return { ok: false };

  try {
    const res = await apiFetch<{ status?: string; joined?: boolean; tenant_id: string }>(
      "/team/invite/accept",
      {
        method: "POST",
        body: JSON.stringify({ token }),
      },
    ).catch(async () => {
      // live wrapper
      return apiFetch<{ status: string; tenant_id: string }>("/team/accept", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
    });
    clearInviteToken();
    return { ok: true, tenantId: res.tenant_id };
  } catch {
    return { ok: false };
  }
}
