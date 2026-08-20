import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import { MutationReasonField } from "@/features/superadmin/components/MutationReasonField";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { ConfirmDialog } from "@/features/superadmin/components/ConfirmDialog";
import { sa, superadminFetch } from "@/lib/api/superadmin";

interface UserRow {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string;
  tenant_id: string | null;
  tenant_name: string | null;
  plan: string | null;
  membership_status: string | null;
  last_sign_in_at: string | null;
}

interface UsersPage {
  items: UserRow[];
  total: number;
}

interface TenantsPage {
  items: { id: string; name: string }[];
}

const DEFAULT_REASON = "Superadmin action from Users panel";

type PendingAction =
  | { type: "delete"; user: UserRow }
  | { type: "move"; user: UserRow }
  | null;

export function UsersPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [tenantFilter, setTenantFilter] = useState("");
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [reason, setReason] = useState(DEFAULT_REASON);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [moveTenantId, setMoveTenantId] = useState("");

  const reasonOk = reason.trim().length >= 10;

  const { data: tenantsData } = useQuery({
    queryKey: ["superadmin", "tenants", "options"],
    queryFn: () => superadminFetch<TenantsPage>("/superadmin/tenants?limit=200"),
  });

  const tenants = tenantsData?.items ?? [];

  const queryParams = new URLSearchParams({ limit: "100" });
  if (tenantFilter) queryParams.set("tenant_id", tenantFilter);
  if (search.trim()) queryParams.set("search", search.trim());

  const { data, isLoading, error } = useQuery({
    queryKey: ["superadmin", "users", tenantFilter, search],
    queryFn: () => superadminFetch<UsersPage>(`/superadmin/users?${queryParams}`),
  });

  const users = data?.items ?? [];

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => {
      const r = reason.trim();
      if (r.length < 10) throw new Error("Reason must be at least 10 characters");
      return superadminFetch(`/superadmin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role, reason: r }),
      });
    },
    onMutate: ({ userId }) => setSavingId(userId),
    onSettled: () => {
      setSavingId(null);
      queryClient.invalidateQueries({ queryKey: ["superadmin", "users"] });
    },
  });

  async function runAction(userId: string, fn: () => Promise<unknown>) {
    if (!reasonOk) {
      setActionError("Reason must be at least 10 characters");
      return;
    }
    setActionError("");
    setSavingId(userId);
    try {
      await fn();
      queryClient.invalidateQueries({ queryKey: ["superadmin", "users"] });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSavingId(null);
    }
  }

  async function handleSuspend(user: UserRow) {
    await runAction(user.id, () => sa.suspendUser(user.id, reason.trim()));
  }

  async function handleActivate(user: UserRow) {
    await runAction(user.id, () => sa.activateUser(user.id, reason.trim()));
  }

  async function handleResetPassword(user: UserRow) {
    await runAction(user.id, () => sa.resetPassword(user.id, reason.trim()));
  }

  async function handleMagicLink(user: UserRow) {
    if (!reasonOk) {
      setActionError("Reason must be at least 10 characters");
      return;
    }
    setActionError("");
    setSavingId(user.id);
    try {
      const res = await sa.magicLink(user.id, reason.trim());
      setMagicLink(res.magic_link || "No link returned");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Magic link failed");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete() {
    if (!pendingAction || pendingAction.type !== "delete") return;
    const user = pendingAction.user;
    await runAction(user.id, () => sa.deleteUser(user.id, reason.trim()));
    setPendingAction(null);
  }

  async function handleMoveTenant() {
    if (!pendingAction || pendingAction.type !== "move" || !moveTenantId) return;
    const user = pendingAction.user;
    await runAction(user.id, () => sa.moveUserTenant(user.id, moveTenantId, reason.trim()));
    setPendingAction(null);
    setMoveTenantId("");
  }

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

  const isSuspended = (u: UserRow) =>
    u.membership_status === "suspended" || u.membership_status === "inactive";

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6 bg-surface-canvas">
      <div>
        <h1 className="text-display text-2xl">Users</h1>
        <p className="text-caption mt-1">Cross-tenant user management (superadmin)</p>
      </div>

      <GlowSurfaceCard className="grid gap-4 md:grid-cols-3">
        <div>
          <Label className="text-xs text-text-muted">Filter by tenant</Label>
          <Select value={tenantFilter || "all"} onValueChange={(v) => setTenantFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="All tenants" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tenants</SelectItem>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-text-muted">Search email / name</Label>
          <Input className="mt-1" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Searchâ€¦" />
        </div>
        <MutationReasonField value={reason} onChange={setReason} />
      </GlowSurfaceCard>

      {(error || actionError) && (
        <p className="text-sm text-red-600">
          {actionError || (error instanceof Error ? error.message : "Failed to load users")}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-12 rounded" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <GlowSurfaceCard className="text-center py-16">
          <p className="font-medium text-text-primary">No users found</p>
        </GlowSurfaceCard>
      ) : (
        <GlowSurfaceCard padding="none" className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name / Email</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead className="w-40">Change role</TableHead>
                <TableHead className="w-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <p className="font-medium">{u.display_name || "â€”"}</p>
                    <p className="text-xs text-text-muted">{u.email || u.id.slice(0, 8)}</p>
                  </TableCell>
                  <TableCell className="text-sm">{u.tenant_name || "â€”"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{u.plan || "â€”"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={isSuspended(u) ? "destructive" : "secondary"}>
                      {u.membership_status || "active"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === "admin" || u.role === "superadmin" ? "default" : "secondary"}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-text-muted">
                    {formatRelative(u.last_sign_in_at)}
                  </TableCell>
                  <TableCell>
                    <Select
                      defaultValue={u.role}
                      onValueChange={(role) => roleMutation.mutate({ userId: u.id, role })}
                      disabled={savingId === u.id || !reasonOk}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="user">user</SelectItem>
                        <SelectItem value="superadmin">superadmin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={savingId === u.id}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!isSuspended(u) ? (
                          <DropdownMenuItem
                            disabled={!reasonOk}
                            onClick={() => void handleSuspend(u)}
                          >
                            Suspend
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            disabled={!reasonOk}
                            onClick={() => void handleActivate(u)}
                          >
                            Activate
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          disabled={!reasonOk}
                          onClick={() => void handleResetPassword(u)}
                        >
                          Reset password
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!reasonOk}
                          onClick={() => void handleMagicLink(u)}
                        >
                          Magic link
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!reasonOk}
                          onClick={() => {
                            setMoveTenantId(u.tenant_id ?? tenants[0]?.id ?? "");
                            setPendingAction({ type: "move", user: u });
                          }}
                        >
                          Move to tenant
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={!reasonOk}
                          className="text-red-600 focus:text-red-600"
                          onClick={() => setPendingAction({ type: "delete", user: u })}
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
      )}

      <AlertDialog open={!!magicLink} onOpenChange={(open) => !open && setMagicLink(null)}>
        <AlertDialogContent className="border-sa-border bg-sa-surface text-sa-text sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Magic link</AlertDialogTitle>
            <AlertDialogDescription className="text-sa-muted">
              Share this link with the user. It expires after first use.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            readOnly
            value={magicLink ?? ""}
            className="font-mono text-xs border-sa-border bg-sa-raised"
            onFocus={(e) => e.target.select()}
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="border-sa-border bg-sa-raised text-sa-text">
              Close
            </AlertDialogCancel>
            <Button
              onClick={() => {
                if (magicLink) void navigator.clipboard.writeText(magicLink);
              }}
            >
              Copy link
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pendingAction?.type === "delete" && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingAction(null)}
          title="Delete user"
          description={`Permanently delete ${pendingAction.user.email || pendingAction.user.display_name || "this user"}? This cannot be undone.`}
          confirmLabel="Delete user"
          confirmPhrase="DELETE"
          onConfirm={handleDelete}
          loading={savingId === pendingAction.user.id}
        />
      )}

      <AlertDialog
        open={pendingAction?.type === "move"}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
            setMoveTenantId("");
          }
        }}
      >
        <AlertDialogContent className="border-sa-border bg-sa-surface text-sa-text sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Move user to tenant</AlertDialogTitle>
            <AlertDialogDescription className="text-sa-muted">
              Reassign{" "}
              {pendingAction?.type === "move"
                ? pendingAction.user.email || pendingAction.user.display_name
                : "user"}{" "}
              to a different tenant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label className="text-xs">Target tenant</Label>
            <Select value={moveTenantId} onValueChange={setMoveTenantId}>
              <SelectTrigger className="mt-1 border-sa-border bg-sa-raised">
                <SelectValue placeholder="Select tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-sa-border bg-sa-raised text-sa-text">
              Cancel
            </AlertDialogCancel>
            <Button
              disabled={!reasonOk || !moveTenantId || savingId != null}
              loading={pendingAction?.type === "move" && savingId === pendingAction.user.id}
              onClick={() => void handleMoveTenant()}
            >
              Move user
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
