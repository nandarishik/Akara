import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SurfaceCard from "@/components/ui/SurfaceCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { superadminFetch } from "@/lib/api/superadmin";

interface UserRow {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string;
  tenant_id: string | null;
  tenant_name: string | null;
  plan: string | null;
  membership_status: string | null;
}

interface UsersPage {
  items: UserRow[];
  total: number;
}

interface TenantsPage {
  items: { id: string; name: string }[];
}

const DEFAULT_REASON = "Superadmin role change from Users panel";

export function UsersPage() {
  const queryClient = useQueryClient();
  const [tenantFilter, setTenantFilter] = useState("");
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState(DEFAULT_REASON);
  const [savingId, setSavingId] = useState<string | null>(null);

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

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6 bg-surface-canvas">
      <div>
        <h1 className="text-display text-2xl">Users</h1>
        <p className="text-caption mt-1">Cross-tenant user management (superadmin)</p>
      </div>

      <SurfaceCard className="grid gap-4 md:grid-cols-3">
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
          <Input className="mt-1" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" />
        </div>
        <div>
          <Label className="text-xs text-text-muted">Audit reason (min 10 chars)</Label>
          <Input className="mt-1" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </SurfaceCard>

      {error && (
        <p className="text-sm text-red-600">{error instanceof Error ? error.message : "Failed to load users"}</p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-12 rounded" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <SurfaceCard className="text-center py-16">
          <p className="font-medium text-text-primary">No users found</p>
        </SurfaceCard>
      ) : (
        <SurfaceCard padding="none" className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name / Email</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-40">Change role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <p className="font-medium">{u.display_name || "—"}</p>
                    <p className="text-xs text-text-muted">{u.email || u.id.slice(0, 8)}</p>
                  </TableCell>
                  <TableCell className="text-sm">{u.tenant_name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{u.plan || "—"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === "admin" || u.role === "superadmin" ? "default" : "secondary"}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      defaultValue={u.role}
                      onValueChange={(role) => roleMutation.mutate({ userId: u.id, role })}
                      disabled={savingId === u.id || reason.trim().length < 10}
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SurfaceCard>
      )}
    </div>
  );
}
