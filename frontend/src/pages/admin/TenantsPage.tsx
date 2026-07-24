import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import SurfaceCard from "@/components/ui/SurfaceCard";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

async function fetchTenants(token: string): Promise<Tenant[]> {
  const res = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/admin/tenants`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error("Failed to fetch tenants");
  return res.json();
}

export function TenantsPage() {
  const { session } = useAuth();
  const { data: tenants, isLoading } = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => fetchTenants(session!.access_token),
    enabled: !!session,
  });

  if (isLoading) return <div className="p-8 text-text-secondary">Loading tenants...</div>;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto bg-surface-canvas">
      <h1 className="text-display text-2xl">Tenants</h1>
      <SurfaceCard padding="none" className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(tenants || []).map((t) => (
            <TableRow key={t.id}>
              <TableCell>{t.name}</TableCell>
              <TableCell className="font-mono text-sm">{t.slug}</TableCell>
              <TableCell>
                <Badge variant={t.is_active ? "default" : "secondary"}>
                  {t.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <Button variant="outline" size="sm">
                  Manage
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </SurfaceCard>
    </div>
  );
}
