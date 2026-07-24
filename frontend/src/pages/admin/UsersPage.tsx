import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
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

interface TenantUser {
  id: string;
  tenant_id: string;
  role: "admin" | "user";
  display_name: string | null;
}

async function fetchUsers(
  token: string,
  tenantId: string
): Promise<TenantUser[]> {
  const res = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/admin/users/${tenantId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

async function updateUserRole(
  token: string,
  userId: string,
  role: string
): Promise<TenantUser> {
  const res = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/admin/users/${userId}/role`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role }),
    }
  );
  if (!res.ok) throw new Error("Failed to update role");
  return res.json();
}

export function UsersPage() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin", "users", user?.tenantId],
    queryFn: () => fetchUsers(session!.access_token, user!.tenantId!),
    enabled: !!session && !!user?.tenantId,
  });

  const roleMutation = useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: string;
    }) => updateUserRole(session!.access_token, userId, role),
    onMutate: ({ userId }) => setSavingId(userId),
    onSettled: () => {
      setSavingId(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-3 bg-surface-canvas">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-12 rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6 bg-surface-canvas">
      <div>
        <h1 className="text-display text-2xl">Users</h1>
        <p className="text-caption mt-1">
          Manage roles for users in your tenant
        </p>
      </div>

      {(!users || users.length === 0) ? (
        <SurfaceCard className="text-center py-16">
          <p className="font-medium text-text-primary">No users found</p>
          <p className="text-caption mt-1">
            Invite users via Supabase Auth → Users → Invite User
          </p>
        </SurfaceCard>
      ) : (
        <SurfaceCard padding="none" className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-40">Change Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.display_name || (
                    <span className="text-slate-400 italic">No name set</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-slate-500">
                  {u.id.slice(0, 8)}…
                </TableCell>
                <TableCell>
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Select
                      defaultValue={u.role}
                      onValueChange={(role) =>
                        roleMutation.mutate({ userId: u.id, role })
                      }
                      disabled={
                        savingId === u.id ||
                        // Prevent the current user from removing their own admin
                        u.id === session?.user?.id
                      }
                    >
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="user">user</SelectItem>
                      </SelectContent>
                    </Select>
                    {savingId === u.id && (
                      <span className="text-xs text-slate-400">Saving…</span>
                    )}
                  </div>
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
