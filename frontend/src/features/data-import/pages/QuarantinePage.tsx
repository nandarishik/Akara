import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

import {
  downloadQuarantineExport,
  getCafeFlags,
  ignoreQuarantine,
  listImportJobs,
  listQuarantine,
  resubmitQuarantine,
} from "@/features/data-import/api/cafeImportApi";
import type { CafeFlags, QuarantineRow } from "@/features/data-import/api/types";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import GlowCTAButton from "@/shared/ui/GlowCTAButton";
import { SecondaryButton } from "@/shared/ui/GradientButton";
import { toast } from "@/shared/ui/toast";
import { formatApiError } from "@/lib/formatApiError";

export function QuarantinePage() {
  const [params] = useSearchParams();
  const importIdParam = params.get("import_id");
  const [importId, setImportId] = useState(importIdParam ?? "");
  const [flags, setFlags] = useState<CafeFlags | null>(null);
  const [rows, setRows] = useState<QuarantineRow[]>([]);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editRow, setEditRow] = useState<QuarantineRow | null>(null);
  const [editJson, setEditJson] = useState("{}");
  const [editErrors, setEditErrors] = useState<string | null>(null);
  const [jobOptions, setJobOptions] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    void getCafeFlags()
      .then(setFlags)
      .catch(() =>
        setFlags({
          cafe_import: true,
          ai_mapping: false,
          quarantine_ui: true,
          max_upload_bytes: 50_000_000,
        }),
      );
    void listImportJobs()
      .then((raw) => {
        const jobs = Array.isArray(raw)
          ? raw
          : ((raw as { jobs?: unknown[] })?.jobs ?? []);
        setJobOptions(
          (jobs as { id: string; filename?: string; import_type?: string }[])
            .filter((j) => !j.import_type || String(j.import_type).startsWith("cafe"))
            .map((j) => ({ id: j.id, label: j.filename ?? j.id })),
        );
      })
      .catch(() => undefined);
  }, []);

  const refresh = useCallback(async () => {
    if (!importId) return;
    const list = await listQuarantine(importId, true);
    setRows(list.rows);
    setUnresolvedCount(list.unresolved_count);
  }, [importId]);

  useEffect(() => {
    void refresh().catch((e) => toast.error(formatApiError(e)));
  }, [refresh]);

  const firstRaw = useMemo(
    () => (row: QuarantineRow) => {
      const keys = Object.keys(row.raw_row ?? {});
      if (!keys.length) return "—";
      const k = keys[0];
      return `${k}=${String(row.raw_row[k])}`;
    },
    [],
  );

  if (flags && flags.quarantine_ui === false) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <GlowSurfaceCard padding="lg" hover={false}>
          <p className="text-white">Quarantine review is off for this workspace.</p>
          <Link to="/data" className="text-accent text-sm hover:underline mt-3 inline-block">
            Back to Data
          </Link>
        </GlowSurfaceCard>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Quarantine</h1>
          <p className="text-sm text-text-muted mt-1">
            Unresolved rows: {unresolvedCount}
          </p>
        </div>
        <Link to="/data" className="text-sm text-accent hover:underline">
          Back to Data
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm text-text-muted">
          Import
          <select
            className="mt-1 block rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white min-w-[220px]"
            value={importId}
            onChange={(e) => setImportId(e.target.value)}
          >
            <option value="">Select import…</option>
            {jobOptions.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </select>
        </label>
        <SecondaryButton
          type="button"
          disabled={!importId}
          onClick={() =>
            void downloadQuarantineExport(importId)
              .then((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `quarantine-${importId}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              })
              .catch((e) => toast.error(formatApiError(e)))
          }
        >
          Export CSV
        </SecondaryButton>
        <SecondaryButton
          type="button"
          disabled={selected.size === 0}
          data-testid="quarantine-bulk-ignore"
          onClick={() =>
            void (async () => {
              for (const id of selected) {
                await ignoreQuarantine(importId, id);
              }
              setSelected(new Set());
              await refresh();
            })().catch((e) => toast.error(formatApiError(e)))
          }
        >
          Ignore selected
        </SecondaryButton>
      </div>

      <GlowSurfaceCard padding="none" hover={false} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-text-muted">
            <tr>
              <th className="px-3 py-2" />
              <th className="px-3 py-2">Row #</th>
              <th className="px-3 py-2">Failure Type</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2">Raw Value</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(row.id);
                        else next.delete(row.id);
                        return next;
                      });
                    }}
                  />
                </td>
                <td className="px-3 py-2 text-white">{row.row_number}</td>
                <td className="px-3 py-2 text-white">{row.failure_type}</td>
                <td className="px-3 py-2 text-text-muted">{row.failure_reason}</td>
                <td className="px-3 py-2 text-text-muted">{row.canonical_field ?? "—"}</td>
                <td className="px-3 py-2 text-text-muted truncate max-w-[160px]">
                  {firstRaw(row)}
                </td>
                <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    data-testid="quarantine-edit"
                    onClick={() => {
                      setEditRow(row);
                      setEditJson(JSON.stringify(row.raw_row ?? {}, null, 2));
                      setEditErrors(null);
                    }}
                  >
                    Edit &amp; Retry
                  </button>
                  <button
                    type="button"
                    className="text-text-muted hover:underline"
                    data-testid="quarantine-ignore"
                    onClick={() =>
                      void ignoreQuarantine(importId, row.id)
                        .then(() => refresh())
                        .catch((e) => toast.error(formatApiError(e)))
                    }
                  >
                    Ignore
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-text-muted">
                  {importId ? "No unresolved quarantine rows." : "Select an import to review."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </GlowSurfaceCard>

      {editRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <GlowSurfaceCard padding="lg" hover={false} className="max-w-lg w-full space-y-4">
            <h2 className="text-lg text-white font-medium">Edit row #{editRow.row_number}</h2>
            <textarea
              className="w-full min-h-[180px] rounded-lg bg-black/40 border border-white/10 p-3 font-mono text-xs text-white"
              value={editJson}
              onChange={(e) => setEditJson(e.target.value)}
            />
            {editErrors && <p className="text-sm text-red-300">{editErrors}</p>}
            <div className="flex gap-2 justify-end">
              <SecondaryButton type="button" onClick={() => setEditRow(null)}>
                Cancel
              </SecondaryButton>
              <GlowCTAButton
                type="button"
                data-testid="quarantine-resubmit"
                onClick={() =>
                  void (async () => {
                    try {
                      const corrected = JSON.parse(editJson) as Record<string, unknown>;
                      const res = await resubmitQuarantine(importId, editRow.id, corrected);
                      if (!res.resolved) {
                        setEditErrors(JSON.stringify(res.errors ?? res));
                        return;
                      }
                      setEditRow(null);
                      await refresh();
                    } catch (e) {
                      setEditErrors(formatApiError(e));
                    }
                  })()
                }
              >
                Resubmit
              </GlowCTAButton>
            </div>
          </GlowSurfaceCard>
        </div>
      )}
    </div>
  );
}
