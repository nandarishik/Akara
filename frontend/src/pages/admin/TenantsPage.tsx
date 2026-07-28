import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import GlowSurfaceCard from "@/components/ui/GlowSurfaceCard";
import { Badge } from "@/components/ui/badge";
import { superadminFetch } from "@/lib/api/superadmin";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  plan_status: string;
  is_active: boolean;
  user_count: number;
  copilot_calls_this_month: number;
  rows_stored: number;
  last_import_at: string | null;
  internal_notes: string;
}

interface TenantPage {
  items: Tenant[];
  total: number;
}

interface DebriefStatus {
  tenant_id: string;
  last_debrief_at: string | null;
  debrief_count: number;
  last_email_status: string | null;
  last_whatsapp_status: string | null;
}

export function TenantsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["superadmin", "tenants"],
    queryFn: () => superadminFetch<TenantPage>("/superadmin/tenants?limit=100"),
    retry: false,
  });

  const { data: debriefStatus } = useQuery({
    queryKey: ["superadmin", "tenants", selectedId, "debrief-status"],
    queryFn: () =>
      superadminFetch<DebriefStatus>(`/superadmin/tenants/${selectedId}/debrief-status`),
    enabled: !!selectedId,
  });

  const tenants = data?.items ?? [];
  const selected = tenants.find((t) => t.id === selectedId) ?? null;

  if (isLoading) {
    return <div className="p-8 text-text-secondary">Loading tenants...</div>;
  }

  if (isError) {
    const msg = error instanceof Error ? error.message : "Could not load tenants";
    const denied = msg.includes("404");
    return (
      <div className="p-8 max-w-lg space-y-3">
        <h1 className="text-display text-2xl">Tenants</h1>
        <p className="text-red-700 text-sm">
          {denied
            ? "Superadmin access required. Confirm profiles.role = superadmin, sign out/in, then open /superadmin and complete the sudo gate."
            : msg}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto bg-surface-canvas">
      <div className="flex items-center justify-between">
        <h1 className="text-display text-2xl">Tenants</h1>
        <span className="text-sm text-text-muted">{data?.total ?? tenants.length} total</span>
      </div>

      <GlowSurfaceCard padding="none" className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Copilot (mo)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-text-muted font-mono">{t.slug}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">{t.plan}</Badge>
                </TableCell>
                <TableCell>{t.user_count}</TableCell>
                <TableCell>{t.copilot_calls_this_month}</TableCell>
                <TableCell>
                  <Badge variant={t.is_active ? "default" : "secondary"}>
                    {t.is_active ? t.plan_status : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => setSelectedId(t.id)}>
                    Manage
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlowSurfaceCard>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="w-full max-w-md h-full bg-surface-card shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-surface-card border-b border-surface-border px-5 py-4 flex items-center justify-between">
              <h2 className="font-semibold">{selected.name}</h2>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="p-1 rounded hover:bg-surface-raised"
                aria-label="Close tenant drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-text-muted text-xs">Plan</p>
                  <p className="font-medium capitalize">{selected.plan}</p>
                </div>
                <div>
                  <p className="text-text-muted text-xs">Rows stored</p>
                  <p className="font-medium">{selected.rows_stored.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-text-muted text-xs">Last import</p>
                  <p className="font-medium">
                    {selected.last_import_at
                      ? new Date(selected.last_import_at).toLocaleDateString("en-IN")
                      : "Never"}
                  </p>
                </div>
                <div>
                  <p className="text-text-muted text-xs">Users</p>
                  <p className="font-medium">{selected.user_count}</p>
                </div>
              </div>

              <GlowSurfaceCard padding="sm" className="space-y-2">
                <h3 className="font-semibold text-sm">Weekly debrief</h3>
                {debriefStatus ? (
                  <dl className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <dt className="text-text-muted">Debriefs sent</dt>
                      <dd>{debriefStatus.debrief_count}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-text-muted">Last debrief</dt>
                      <dd>
                        {debriefStatus.last_debrief_at
                          ? new Date(debriefStatus.last_debrief_at).toLocaleString("en-IN")
                          : "None yet"}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-text-muted">Last email</dt>
                      <dd className="capitalize">{debriefStatus.last_email_status ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-text-muted">Last WhatsApp</dt>
                      <dd className="capitalize">{debriefStatus.last_whatsapp_status ?? "—"}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-text-muted">Loading debrief status…</p>
                )}
              </GlowSurfaceCard>

              {selected.internal_notes && (
                <GlowSurfaceCard padding="sm">
                  <h3 className="font-semibold text-sm mb-1">Internal notes</h3>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">
                    {selected.internal_notes}
                  </p>
                </GlowSurfaceCard>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
