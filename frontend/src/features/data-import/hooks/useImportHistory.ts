import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/contexts/AuthContext";

const BASE = import.meta.env.VITE_API_BASE_URL;

export interface ImportHistoryItem {
  id: string;
  title: string;
  created_at: string;
  metadata: {
    import_id:     string;
    source_type:   "primary" | "secondary" | "scheme";
    rows_inserted: number;
    rows_skipped:  number;
    filename:      string;
    sheet_name:    string | null;
  };
}

export function useImportHistory() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["import-history"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/data/imports/history`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to load import history");
      return res.json() as Promise<ImportHistoryItem[]>;
    },
    enabled: !!session,
    staleTime: 1000 * 30,
  });
}

export function useUndoImport() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (importId: string) => {
      const res = await fetch(`${BASE}/data/imports/${importId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) throw new Error("Undo failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-history"] });
      queryClient.invalidateQueries({ queryKey: ["kpi"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-data-bounds"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
