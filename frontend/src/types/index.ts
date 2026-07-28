export interface User {
  id: string;
  email: string;
  tenantId: string | null;
  role: "admin" | "user" | "superadmin";
  displayName?: string;
  impersonatingTenantId?: string | null;
  impersonatingTenantName?: string | null;
  impersonationSessionId?: string | null;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  config: Record<string, unknown>;
  isActive: boolean;
}
