import type { SuperadminRole } from "@/lib/api/superadmin";

type NonNullRole = Exclude<SuperadminRole, null>;

const ALL_ROLES: NonNullRole[] = [
  "SUPER_ADMIN",
  "SUPPORT",
  "BILLING_OPS",
  "CONTENT_OPS",
];

const SUPER_ADMIN_ONLY: NonNullRole[] = ["SUPER_ADMIN"];

const BILLING_ROLES: NonNullRole[] = ["BILLING_OPS", "SUPER_ADMIN"];

const CONTENT_ROLES: NonNullRole[] = ["CONTENT_OPS", "SUPER_ADMIN"];

const TENANT_ROLES: NonNullRole[] = ["SUPPORT", "BILLING_OPS", "SUPER_ADMIN"];

/** Path segment (after /superadmin/) → allowed roles. Null role treated as SUPER_ADMIN at check time. */
const PATH_ROLES: Record<string, NonNullRole[]> = {
  "query-console": SUPER_ADMIN_ONLY,
  runbooks: SUPER_ADMIN_ONLY,
  jobs: SUPER_ADMIN_ONLY,
  "control-plane": SUPER_ADMIN_ONLY,
  "data-studio": SUPER_ADMIN_ONLY,
  "ai-control": SUPER_ADMIN_ONLY,
  billing: BILLING_ROLES,
  plans: BILLING_ROLES,
  revenue: BILLING_ROLES,
  content: CONTENT_ROLES,
  legal: CONTENT_ROLES,
  tenants: TENANT_ROLES,
  users: TENANT_ROLES,
  usage: TENANT_ROLES,
  overview: ALL_ROLES,
  audit: ALL_ROLES,
  settings: ALL_ROLES,
  cron: ALL_ROLES,
  comms: ALL_ROLES,
  ai: ALL_ROLES,
  "totp-setup": ALL_ROLES,
  impersonation: ALL_ROLES,
};

function segmentFromPath(path: string): string {
  const cleaned = path.split("?")[0]?.split("#")[0] ?? path;
  const parts = cleaned.split("/").filter(Boolean);
  const idx = parts.indexOf("superadmin");
  if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  return parts[0] ?? "";
}

export function allowedRolesForPath(path: string): NonNullRole[] {
  const segment = segmentFromPath(path);
  return PATH_ROLES[segment] ?? SUPER_ADMIN_ONLY;
}

export function canAccessPath(path: string, role: SuperadminRole): boolean {
  const effective: NonNullRole = role ?? "SUPER_ADMIN";
  return allowedRolesForPath(path).includes(effective);
}
