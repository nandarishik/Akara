import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface Report {
  id: string;
  report_type: string;
  title: string;
  storage_path: string | null;
  file_size_bytes: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SchemeLeakageRow {
  party_name: string;
  scheme_name: string;
  product_name: string;
  claimed_amount: number;
  actual_offtake: number;
  leakage_amount: number;
  scheme_start: string;
  scheme_end: string;
}

export function useReports() {
  return useQuery<Report[]>({
    queryKey: ["reports"],
    queryFn: () => apiFetch<Report[]>("/reports/"),
  });
}

export function useSchemeLeakage() {
  return useQuery<SchemeLeakageRow[]>({
    queryKey: ["reports", "scheme-leakage"],
    queryFn: () => apiFetch<SchemeLeakageRow[]>("/reports/scheme-leakage"),
  });
}
