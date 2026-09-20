import { supabase } from "@/lib/supabase";

import type {
  ConnectorDetail,
  ConnectorListResponse,
  CreateConnectorBody,
  LogsResponse,
  PatchConnectorBody,
  SyncAcceptedResponse,
  SystemSettingsConnectors,
  TestConnectionResponse,
} from "./types";

const BASE = import.meta.env.VITE_API_BASE_URL as string;
/** Connectors HTTP is frozen at `/api/v1/connectors` (unlike unprefixed `/data`). */
const API_PREFIX = (import.meta.env.VITE_API_PREFIX as string | undefined) ?? "";
export const CONNECTORS_API_PREFIX = "/api/v1/connectors";

export function connectorsApiPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BASE}${API_PREFIX}${normalized}`;
}

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return token;
}

async function connectorsFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(connectorsApiPath(path), { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return undefined as T;
  return res.json() as Promise<T>;
}

/** Path builders for unit tests — must contain `/api/v1/connectors`. */
export const _paths = {
  list: () => `${CONNECTORS_API_PREFIX}/`,
  create: () => `${CONNECTORS_API_PREFIX}/`,
  detail: (id: string) => `${CONNECTORS_API_PREFIX}/${id}`,
  test: (id: string) => `${CONNECTORS_API_PREFIX}/${id}/test`,
  sync: (id: string) => `${CONNECTORS_API_PREFIX}/${id}/sync`,
  logs: (id: string, cursor?: string | null, limit = 20) => {
    const q = new URLSearchParams();
    if (cursor) q.set("cursor", cursor);
    q.set("limit", String(limit));
    const qs = q.toString();
    return `${CONNECTORS_API_PREFIX}/${id}/logs${qs ? `?${qs}` : ""}`;
  },
  tallyPush: () => `${CONNECTORS_API_PREFIX}/tally/push`,
};

export async function listConnectors(): Promise<ConnectorListResponse> {
  return connectorsFetch(_paths.list());
}

export async function getConnector(id: string): Promise<ConnectorDetail> {
  return connectorsFetch(_paths.detail(id));
}

export async function createConnector(body: CreateConnectorBody): Promise<ConnectorDetail> {
  return connectorsFetch(_paths.create(), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchConnector(
  id: string,
  body: PatchConnectorBody,
): Promise<ConnectorDetail> {
  return connectorsFetch(_paths.detail(id), {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteConnector(id: string): Promise<void> {
  await connectorsFetch(_paths.detail(id), { method: "DELETE" });
}

export async function testConnector(id: string): Promise<TestConnectionResponse> {
  return connectorsFetch(_paths.test(id), { method: "POST", body: "{}" });
}

export async function syncConnector(id: string): Promise<SyncAcceptedResponse> {
  return connectorsFetch(_paths.sync(id), { method: "POST", body: "{}" });
}

export async function getConnectorLogs(
  id: string,
  cursor?: string | null,
  limit = 20,
): Promise<LogsResponse> {
  return connectorsFetch(_paths.logs(id, cursor, limit));
}

/** Public settings — no Bearer (same as SystemBanner). */
export async function getSystemSettings(): Promise<SystemSettingsConnectors> {
  const res = await fetch(connectorsApiPath("/system/settings"));
  if (!res.ok) throw new Error("settings unavailable");
  return res.json() as Promise<SystemSettingsConnectors>;
}
