export interface User {
  id: string;
  email: string;
  tenantId: string | null;
  role: "admin" | "user";
  displayName?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  config: Record<string, unknown>;
  isActive: boolean;
}
