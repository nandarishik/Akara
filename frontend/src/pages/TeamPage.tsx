import { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";

import { apiFetch } from "@/lib/api";
import SurfaceCard from "@/components/ui/SurfaceCard";
import { AkaraButton } from "@/components/ui/GradientButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PlanGate } from "@/components/billing/PlanGate";
import { useBilling } from "@/hooks/useBilling";

type Member = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  membership_status: string;
};

type Invite = {
  id: string;
  email_normalized: string;
  role: string;
  status: string;
  expires_at: string;
};

type TeamPageProps = {
  embedded?: boolean;
};

export function TeamPage({ embedded = false }: TeamPageProps) {
  const { data: usage } = useBilling();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [selectedKeep, setSelectedKeep] = useState<Set<string>>(new Set());

  const seatLimit = usage?.users_limit ?? 1;
  const activeMembers = members.filter((m) => m.membership_status === "active");
  const occupied = activeMembers.length + invites.length;
  const atSeatLimit = occupied >= seatLimit;

  async function refresh() {
    setLoading(true);
    try {
      const [m, i] = await Promise.all([
        apiFetch<Member[]>("/team/members"),
        usage?.features.team_invites
          ? apiFetch<Invite[]>("/team/invites").catch(() => [])
          : Promise.resolve([]),
      ]);
      setMembers(m);
      setInvites(i);
      setSelectedKeep(new Set(m.filter((x) => x.membership_status === "active").map((x) => x.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [usage?.features.team_invites]);

  async function handleInvite() {
    if (!email.trim() || atSeatLimit) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch("/team/invite", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), role: "user" }),
      });
      setEmail("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setSaving(false);
    }
  }

  async function cancelInvite(id: string) {
    await apiFetch(`/team/invites/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function changeRole(memberId: string, role: string) {
    await apiFetch(`/team/members/${memberId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
    await refresh();
  }

  async function reactivateMember(memberId: string) {
    await apiFetch(`/team/members/${memberId}/reactivate`, { method: "POST" });
    await refresh();
  }

  async function submitDowngradeSelection() {
    await apiFetch("/team/downgrade-seat-selection", {
      method: "POST",
      body: JSON.stringify({ keep_user_ids: Array.from(selectedKeep) }),
    });
    setShowDowngradeModal(false);
    await refresh();
  }

  const content = (
    <>
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-accent" />
            Team
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Seats: {occupied} / {seatLimit} (includes pending invites)
          </p>
        </div>
      )}

      {embedded && (
        <p className="text-sm text-text-secondary">
          Seats: {occupied} / {seatLimit}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : (
        <>
          <SurfaceCard className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">Invite teammate</h2>
              {seatLimit < activeMembers.length && (
                <AkaraButton variant="secondary" size="sm" onClick={() => setShowDowngradeModal(true)}>
                  Select seats after downgrade
                </AkaraButton>
              )}
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="inviteEmail" className="sr-only">Email</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  placeholder="colleague@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={atSeatLimit}
                />
              </div>
              <AkaraButton onClick={handleInvite} disabled={saving || atSeatLimit} size="sm">
                {saving ? "Sending…" : "Send invite"}
              </AkaraButton>
            </div>
            {atSeatLimit && (
              <p className="text-xs text-amber-700">Seat limit reached — cancel a pending invite or upgrade.</p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </SurfaceCard>

          <SurfaceCard>
            <h2 className="font-semibold mb-3">Members</h2>
            <ul className="divide-y divide-surface-border">
              {members.map((m) => (
                <li key={m.id} className="py-3 flex flex-wrap justify-between gap-2 text-sm items-center">
                  <span>{m.display_name || m.email}</span>
                  <div className="flex items-center gap-2">
                    {m.membership_status === "seat_locked" && (
                      <Badge variant="outline" className="text-xs text-amber-700">seat locked</Badge>
                    )}
                    {m.membership_status === "suspended" && (
                      <Badge variant="outline" className="text-xs text-red-600">suspended</Badge>
                    )}
                    {m.membership_status === "seat_locked" ? (
                      <AkaraButton variant="secondary" size="sm" onClick={() => reactivateMember(m.id)}>
                        Reactivate
                      </AkaraButton>
                    ) : (
                      <select
                        className="text-xs border rounded px-2 py-1 bg-surface-canvas"
                        value={m.role}
                        onChange={(e) => changeRole(m.id, e.target.value)}
                        disabled={m.membership_status !== "active"}
                      >
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                      </select>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </SurfaceCard>

          {invites.length > 0 && (
            <SurfaceCard>
              <h2 className="font-semibold mb-3">Pending invites</h2>
              <ul className="space-y-2">
                {invites.map((inv) => (
                  <li key={inv.id} className="flex justify-between items-center text-sm py-2">
                    <span>{inv.email_normalized}</span>
                    <button
                      type="button"
                      className="text-red-600 text-xs hover:underline"
                      onClick={() => cancelInvite(inv.id)}
                    >
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            </SurfaceCard>
          )}
        </>
      )}

      {showDowngradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <SurfaceCard className="max-w-md w-full space-y-4">
            <h3 className="font-semibold">Choose members to keep active</h3>
            <p className="text-sm text-text-secondary">
              Your plan allows {seatLimit} seat{seatLimit === 1 ? "" : "s"}. Select who stays active.
            </p>
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {members.filter((m) => m.membership_status === "active").map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedKeep.has(m.id)}
                    onChange={(e) => {
                      const next = new Set(selectedKeep);
                      if (e.target.checked) next.add(m.id);
                      else next.delete(m.id);
                      setSelectedKeep(next);
                    }}
                  />
                  {m.display_name || m.email}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 justify-end">
              <AkaraButton variant="secondary" size="sm" onClick={() => setShowDowngradeModal(false)}>
                Cancel
              </AkaraButton>
              <AkaraButton size="sm" onClick={submitDowngradeSelection} disabled={selectedKeep.size > seatLimit}>
                Confirm
              </AkaraButton>
            </div>
          </SurfaceCard>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <PlanGate feature="team_invites" requiredPlan="pro" title="Team management">
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">{content}</div>
    </PlanGate>
  );
}
