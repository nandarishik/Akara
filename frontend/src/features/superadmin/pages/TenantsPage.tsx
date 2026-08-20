import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";

import { TenantDrawer } from "@/features/superadmin/components/TenantDrawer";
import { ConfirmDialog } from "@/features/superadmin/components/ConfirmDialog";
import { MutationReasonField } from "@/features/superadmin/components/MutationReasonField";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { sa, type TenantRow } from "@/lib/api/superadmin";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

type DrawerTab = "overview" | "plan" | "features" | "quota" | "billing" | "data" | "danger";

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN");
}

type PendingConfirm =
  | { type: "suspend"; tenant: TenantRow }
  | { type: "wipe"; tenant: TenantRow }
  | { type: "delete"; tenant: TenantRow }
  | null;

const DEFAULT_REASON = "Superadmin action from Tenants panel";

export function TenantsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get("open");
  const filterNew = searchParams.get("filter") === "new";
  const [selectedId, setSelectedId] = useState<string | null>(openId);
  const [drawerTab, setDrawerTab] = useState<DrawerTab | undefined>();
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reason, setReason] = useState(DEFAULT_REASON);
  const [showNewTenant, setShowNewTenant] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newPlan, setNewPlan] = useState("free");
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

  const reasonOk = reason.trim().length >= 10;

  useEffect(() => {
    setSelectedId(openId);
  }, [openId]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["superadmin", "tenants", search, planFilter, statusFilter],
    queryFn: () =>
      sa.tenants({
        limit: 100,
        search: search || undefined,
        plan: planFilter || undefined,
        plan_status: statusFilter || undefined,
      }),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      sa.createTenant({
        name: newName.trim(),
        slug: newSlug.trim(),
        plan: newPlan,
        reason,
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["superadmin", "tenants"] });
      setShowNewTenant(false);
      setNewName("");
      setNewSlug("");
      if (res.tenant?.id) openDrawer(res.tenant.id);
    },
  });

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const tenants = (data?.items ?? []).filter((t) => {
    if (!filterNew) return true;
    if (!t.created_at) return false;
    return new Date(t.created_at).getTime() >= weekAgo;
  });

  function openDrawer(id: string, tab?: DrawerTab) {
    setSelectedId(id);
    setDrawerTab(tab);
    setSearchParams({ open: id });
  }

  function closeDrawer() {
    setSelectedId(null);
    setDrawerTab(undefined);
    setSearchParams({});
  }

  async function handleImpersonate(t: TenantRow) {
    if (!reasonOk) return;
    const r = await sa.impersonate(t.id, reason);
    if (r.magic_link) window.open(r.magic_link, "_blank", "noopener,noreferrer");
  }

  async function handleConfirmAction() {
    if (!pendingConfirm || !reasonOk) return;
    const { tenant } = pendingConfirm;
    if (pendingConfirm.type === "suspend") {
      if (tenant.is_active) await sa.deactivateTenant(tenant.id, reason);
      else await sa.activateTenant(tenant.id, reason);
    } else if (pendingConfirm.type === "wipe") {
      await sa.wipeTenantData(tenant.id, { reason });
    } else if (pendingConfirm.type === "delete") {
      await sa.deleteTenant(tenant.id, { reason, confirm: `DELETE ${tenant.name}` });
    }
    setPendingConfirm(null);
    void queryClient.invalidateQueries({ queryKey: ["superadmin", "tenants"] });
  }

  if (isLoading) {
    return <div className="p-8 text-text-secondary">Loading tenants...</div>;
  }

  if (isError) {
    const msg = error instanceof Error ? error.message : "Could not load tenants";
    return (
      <div className="p-8 max-w-lg space-y-3">
        <h1 className="text-display text-2xl">Tenants</h1>
        <p className="text-red-700 text-sm">{msg}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-display text-2xl">Tenants</h1>
        <Button type="button" size="sm" onClick={() => setShowNewTenant(true)}>
          + New tenant
        </Button>
      </div>

      <MutationReasonField value={reason} onChange={setReason} />

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search name or slug"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="rounded border border-sa-border bg-sa-raised px-2 py-1 text-sm"
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
        >
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
        </select>
        <select
          className="rounded border border-sa-border bg-sa-raised px-2 py-1 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="past_due">Past due</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <GlowSurfaceCard className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead>Rows</TableHead>
              <TableHead>Last active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((t) => (
              <TableRow
                key={t.id}
                className="cursor-pointer hover:bg-white/5"
                onClick={() => openDrawer(t.id)}
              >
                <TableCell>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.slug}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {t.plan}
                  </Badge>
                </TableCell>
                <TableCell className="capitalize">
                  {t.is_active ? t.plan_status : "Inactive"}
                </TableCell>
                <TableCell>{t.user_count}</TableCell>
                <TableCell>
                  <div className="tabular-nums">
                    {t.copilot_calls_this_month}/
                    {t.copilot_limit === -1 ? "âˆž" : t.copilot_limit}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {t.questions_today} today
                  </div>
                </TableCell>
                <TableCell>{t.rows_stored.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatRelative(t.last_active_at)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => openDrawer(t.id)}>
                        View details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!reasonOk}
                        onClick={() => void handleImpersonate(t)}
                      >
                        Impersonate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openDrawer(t.id, "data")}>
                        Data preview
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={!reasonOk}
                        onClick={() => setPendingConfirm({ type: "suspend", tenant: t })}
                      >
                        {t.is_active ? "Suspend" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!reasonOk}
                        className="text-amber-600 focus:text-amber-600"
                        onClick={() => setPendingConfirm({ type: "wipe", tenant: t })}
                      >
                        Wipe data
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!reasonOk}
                        className="text-red-600 focus:text-red-600"
                        onClick={() => setPendingConfirm({ type: "delete", tenant: t })}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlowSurfaceCard>

      <TenantDrawer tenantId={selectedId} initialTab={drawerTab} onClose={closeDrawer} />

      <AlertDialog open={showNewTenant} onOpenChange={setShowNewTenant}>
        <AlertDialogContent className="border-sa-border bg-sa-surface text-sa-text sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>New tenant</AlertDialogTitle>
            <AlertDialogDescription className="text-sa-muted">
              Creates a tenant record. Add users separately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 bg-sa-raised border-sa-border"
              />
            </div>
            <div>
              <Label className="text-xs">Slug</Label>
              <Input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="company-name"
                className="mt-1 bg-sa-raised border-sa-border"
              />
            </div>
            <div>
              <Label className="text-xs">Plan</Label>
              <select
                className="mt-1 w-full rounded border border-sa-border bg-sa-raised p-2 text-sm"
                value={newPlan}
                onChange={(e) => setNewPlan(e.target.value)}
              >
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="business">Business</option>
              </select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-sa-border bg-sa-raised text-sa-text">
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={
                !reasonOk ||
                !newName.trim() ||
                !newSlug.trim() ||
                createMutation.isPending
              }
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Create
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pendingConfirm && (
        <ConfirmDialog
          open
          onOpenChange={() => setPendingConfirm(null)}
          title={
            pendingConfirm.type === "suspend"
              ? pendingConfirm.tenant.is_active
                ? "Suspend tenant"
                : "Activate tenant"
              : pendingConfirm.type === "wipe"
                ? "Wipe tenant data"
                : "Delete tenant"
          }
          description={
            pendingConfirm.type === "suspend"
              ? pendingConfirm.tenant.is_active
                ? "Users will not be able to log in."
                : "Restore tenant access."
              : pendingConfirm.type === "wipe"
                ? "Deletes sales data but keeps the account."
                : "Permanent. All users and data removed."
          }
          confirmPhrase={
            pendingConfirm.type === "delete"
              ? `DELETE ${pendingConfirm.tenant.name}`
              : "CONFIRM"
          }
          onConfirm={handleConfirmAction}
        />
      )}
    </div>
  );
}
