import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchImpersonationSession,
  type ImpersonationSessionResponse,
} from "@/lib/api";
import { endImpersonationSession } from "@/lib/api/superadmin";
import { Button } from "@/shared/ui/button";

function formatExpiresRelative(iso: string | null): string {
  if (!iso) return "unknown";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "soon";
  const mins = Math.ceil(diff / 60_000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.ceil(mins / 60);
  if (hrs < 48) return `in ${hrs}h`;
  return new Date(iso).toLocaleString();
}

export function TenantImpersonationBanner() {
  const queryClient = useQueryClient();
  const [ending, setEnding] = useState(false);
  const [canEnd, setCanEnd] = useState(true);

  const { data } = useQuery<ImpersonationSessionResponse>({
    queryKey: ["impersonation-session"],
    queryFn: fetchImpersonationSession,
    refetchInterval: 60_000,
  });

  if (!data?.active) return null;

  async function handleEnd() {
    if (!data?.session_id || !canEnd) return;
    setEnding(true);
    try {
      await endImpersonationSession(data.session_id, "Tenant ended impersonation session");
      await queryClient.invalidateQueries({ queryKey: ["impersonation-session"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("403")) {
        setCanEnd(false);
      }
    } finally {
      setEnding(false);
    }
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-black"
      role="alert"
    >
      <span>
        An Akara support engineer is viewing your account.
        {data.reason ? <> Reason: &quot;{data.reason}&quot;</> : null}
        {" · "}Expires {formatExpiresRelative(data.expires_at)}
      </span>
      {canEnd && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={ending || !data.session_id}
          onClick={() => void handleEnd()}
          className="border-black/40 bg-transparent text-black hover:bg-black/10"
        >
          {ending ? "Ending…" : "End session"}
        </Button>
      )}
    </div>
  );
}
