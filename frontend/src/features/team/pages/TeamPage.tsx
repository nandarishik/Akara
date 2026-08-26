import { useEffect, useState } from "react";
import { Users } from "lucide-react";

import { apiFetch } from "@/lib/api";
import ProductPageLayout from "@/shared/layout/ProductPageLayout";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import GlowCTAButton from "@/shared/ui/GlowCTAButton";
import PageLoader from "@/shared/ui/PageLoader";
import TeamSeatVisualizer, { buildSeatSlots } from "@/features/team/components/TeamSeatVisualizer";
import { AkaraButton } from "@/shared/ui/GradientButton";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { PlanGate } from "@/features/billing/components/PlanGate";
import { useBilling } from "@/features/billing/hooks/useBilling";

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

  async function resendInvite(id: string) {
    await apiFetch(`/team/invites/${id}/resend`, { method: "POST" });
    await refresh();
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
        </div>
      )}

      {loading ? (
        <PageLoader title="Loading team…" subtitle="" minHeight="min-h-[240px]" />
      ) : (
        <>
          <TeamSeatVisualizer
            slots={buildSeatSlots(members, invites, seatLimit)}
            occupied={occupied}
            seatLimit={seatLimit}
            className="mx-auto"
          />

          <GlowSurfaceCard className="space-y-4">
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
              <GlowCTAButton onClick={() => void handleInvite()} disabled={saving || atSeatLimit} size="sm" loading={saving}>
                Send invite
              </GlowCTAButton>
            </div>
            {atSeatLimit && (
              <p className="text-xs text-amber-700">Seat limit reached — cancel a pending invite or upgrade.</p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </GlowSurfaceCard>

          <GlowSurfaceCard>
            <h2 className="font-semibold mb-3">Members</h2>
            <ul className="divide-y divide-white/10">
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
                        className="text-xs border border-white/10 rounded px-2 py-1 bg-white/5"
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
          </GlowSurfaceCard>

          {invites.length > 0 && (
            <GlowSurfaceCard>
              <h2 className="font-semibold mb-3">Pending invites</h2>
              <ul className="space-y-2">
                {invites.map((inv) => (
                  <li key={inv.id} className="flex justify-between items-center text-sm py-2">
                    <span>{inv.email_normalized}</span>
                    <div className="flex gap-2">
                      <button type="button" className="text-accent text-xs hover:underline" onClick={() => void resendInvite(inv.id)}>
                        Resend
                      </button>
                      <button
                      type="button"
                      className="text-red-600 text-xs hover:underline"
                      onClick={() => cancelInvite(inv.id)}
                    >
                      Cancel
                    </button>
                    </div>
                  </li>
                ))}
              </ul>
            </GlowSurfaceCard>
          )}
        </>
      )}

      {showDowngradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <GlowSurfaceCard className="max-w-md w-full space-y-4">
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
              <GlowCTAButton size="sm" onClick={submitDowngradeSelection} disabled={selectedKeep.size > seatLimit}>
                Confirm
              </GlowCTAButton>
            </div>
          </GlowSurfaceCard>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <PlanGate feature="team_invites" requiredPlan="pro" title="Team management">
      <ProductPageLayout maxWidth="3xl" className="space-y-6">{content}</ProductPageLayout>
    </PlanGate>
  );
}
