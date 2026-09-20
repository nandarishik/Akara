import { supabase } from "@/lib/supabase";

import type {
  CafeFlags,
  CafeImportType,
  CafeSkippedResponse,
  CafeUploadResponse,
  ChannelUpsert,
  CafeChannel,
  CafeLocation,
  DataQuality,
  ImportStatus,
  LocationCreate,
  MappingConfirmBody,
  MappingConfirmResponse,
  MappingProposal,
  QuarantineList,
  Reconciliation,
  ReconciliationConfirmBody,
} from "./types";

const BASE = import.meta.env.VITE_API_BASE_URL as string;
/** Kickoff: live DataPage has no `/v1`. Recorded in session-handoff-p06-dev2.md. */
const API_PREFIX = (import.meta.env.VITE_API_PREFIX as string | undefined) ?? "";

export function cafeApiPath(path: string): string {
  return `${BASE}${API_PREFIX}${path}`;
}

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return token;
}

async function cafeFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(cafeApiPath(path), { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return undefined as T;
  return res.json() as Promise<T>;
}

function uploadPath(importType: CafeImportType | "auto"): string {
  if (importType === "auto") return "/data/imports/cafe-orders";
  return `/data/imports/${importType}`;
}

export async function uploadCafeFile(
  file: File,
  importType: CafeImportType | "auto",
): Promise<CafeUploadResponse | CafeSkippedResponse> {
  const token = await getToken();
  const form = new FormData();
  form.append("file", file);
  let path = uploadPath(importType);
  // Auto: hit cafe-orders without import_type override so server classifies.
  // Explicit types: path encodes type; optional query must match if present.
  if (importType !== "auto") {
    path = `${path}?import_type=${encodeURIComponent(importType)}`;
  }
  const res = await fetch(cafeApiPath(path), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = (await res.json()) as CafeUploadResponse | CafeSkippedResponse;
  if (res.status === 409) return body as CafeSkippedResponse;
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${JSON.stringify(body)}`);
  }
  return body as CafeUploadResponse;
}

export async function getMappingProposal(importId: string): Promise<MappingProposal> {
  return cafeFetch(`/data/imports/${importId}/mapping-proposal`);
}

export async function confirmMapping(
  importId: string,
  body: MappingConfirmBody,
): Promise<MappingConfirmResponse> {
  return cafeFetch(`/data/imports/${importId}/mapping-confirm`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getImportStatus(importId: string): Promise<ImportStatus> {
  return cafeFetch(`/data/imports/${importId}/status`);
}

export async function getReconciliation(importId: string): Promise<Reconciliation> {
  return cafeFetch(`/data/imports/${importId}/reconciliation`);
}

export async function confirmReconciliation(
  importId: string,
  body: ReconciliationConfirmBody,
): Promise<{ undone?: boolean } | Reconciliation> {
  return cafeFetch(`/data/imports/${importId}/reconciliation/confirm`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listQuarantine(
  importId: string,
  unresolved = true,
): Promise<QuarantineList> {
  const q = unresolved ? "?unresolved=true" : "";
  return cafeFetch(`/data/imports/${importId}/quarantine${q}`);
}

export async function resubmitQuarantine(
  importId: string,
  rowId: string,
  corrected_values: Record<string, unknown>,
): Promise<{ resolved: boolean; canonical_id?: string; errors?: unknown[] }> {
  return cafeFetch(`/data/imports/${importId}/quarantine/${rowId}/resubmit`, {
    method: "POST",
    body: JSON.stringify({ corrected_values }),
  });
}

export async function ignoreQuarantine(
  importId: string,
  rowId: string,
  resolution_notes = "ignored",
): Promise<{ resolved: boolean }> {
  return cafeFetch(`/data/imports/${importId}/quarantine/${rowId}/ignore`, {
    method: "POST",
    body: JSON.stringify({ resolution_notes }),
  });
}

/** Build authenticated download URL path (token stays in Authorization header, not query). */
export function exportQuarantineUrl(importId: string): string {
  return cafeApiPath(`/data/imports/${importId}/quarantine/export`);
}

export async function downloadQuarantineExport(importId: string): Promise<Blob> {
  const token = await getToken();
  const res = await fetch(exportQuarantineUrl(importId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API ${res.status}: export failed`);
  return res.blob();
}

export async function listLocations(): Promise<{ locations: CafeLocation[] }> {
  return cafeFetch("/data/cafe/locations");
}

export async function createLocation(body: LocationCreate): Promise<CafeLocation> {
  return cafeFetch("/data/cafe/locations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listChannels(): Promise<{ channels: CafeChannel[] }> {
  return cafeFetch("/data/cafe/channels");
}

export async function upsertChannel(body: ChannelUpsert): Promise<CafeChannel> {
  return cafeFetch("/data/cafe/channels", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getDataQuality(): Promise<DataQuality> {
  return cafeFetch("/data/cafe/data-quality");
}

export async function getCafeFlags(): Promise<CafeFlags> {
  return cafeFetch("/data/cafe/flags");
}

export async function listImportJobs(): Promise<unknown> {
  return cafeFetch("/data/import/jobs");
}

export async function undoImport(importId: string): Promise<void> {
  await cafeFetch(`/data/imports/${importId}`, { method: "DELETE" });
}

/** Exported for tests — path construction only. */
export const _paths = {
  cafeOrders: () => cafeApiPath("/data/imports/cafe-orders"),
  importJobs: () => cafeApiPath("/data/import/jobs"),
  status: (id: string) => cafeApiPath(`/data/imports/${id}/status`),
};
