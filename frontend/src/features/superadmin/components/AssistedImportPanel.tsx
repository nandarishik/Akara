import { useMemo, useRef, useState } from "react";

import { ConfirmDialog } from "@/features/superadmin/components/ConfirmDialog";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  sa,
  type ImportCommitEstimate,
  type ImportPreviewResponse,
  type ImportSourceType,
} from "@/lib/api/superadmin";
import { cn } from "@/lib/utils";

/**
 * Assisted CSV onboarding (superadmin-first): upload → preview → confirm
 * mapping → commit. The domain guarantees (founder quota bypass, mapping
 * memory, cross-tenant isolation) live server-side; this panel is the operator
 * surface. Preview never touches sales tables — it stashes the file and returns
 * a source→canonical mapping the operator can override before committing.
 *
 * Mapping model (must match app/domain/data_import/preview.py):
 *  - Preview merges `{...remembered, ...overrides}` over the built-in aliases,
 *    so overrides sent to preview are a *delta*, keyed by the normalized header.
 *  - Commit re-parses the stashed file with `job.import_mapping` (the full
 *    resolved mapping captured at the last preview) and *remembers* it. It does
 *    NOT re-merge the tenant's remembered mapping, so sending a partial delta at
 *    commit would drop non-alias remembered columns and corrupt mapping memory.
 *    Therefore we never send overrides at commit: the operator must re-scan to
 *    fold edits into the job mapping first (enforced via `mappingDirty`), and
 *    commit/estimate run purely off the stored job mapping.
 */

// Mirrors the parser's canonical fields (app/domain/data_import/parser.py). If
// the parser gains a field, alias auto-mapping still works; it just won't be
// offered as a manual override target here until this list is extended.
const CANONICAL_FIELDS: Record<ImportSourceType, string[]> = {
  primary: [
    "invoice_date", "invoice_number", "party_name", "party_city", "party_zone",
    "route", "product_name", "product_group", "product_category", "hsn_code",
    "quantity", "gross_amount", "discount_amount", "net_amount", "tax_amount",
    "total_amount", "outstanding_amount",
  ],
  secondary: [
    "invoice_date", "invoice_number", "party_name", "party_city", "party_zone",
    "route", "product_name", "product_group", "product_category", "hsn_code",
    "quantity", "gross_amount", "discount_amount", "net_amount", "tax_amount",
    "total_amount", "outstanding_amount",
  ],
  scheme: [
    "scheme_name", "party_name", "product_name", "product_group",
    "discount_pct", "claimed_amount", "scheme_start", "scheme_end",
  ],
};

const SOURCE_LABELS: Record<ImportSourceType, string> = {
  primary: "Primary (sales / dispatch invoices)",
  secondary: "Secondary (DMS offtake)",
  scheme: "Scheme (distributor claims)",
};

interface Props {
  tenantId: string;
  reason: string;
  reasonOk: boolean;
  onStatus: (msg: string) => void;
  onCommitted: () => void | Promise<void>;
}

export function AssistedImportPanel({ tenantId, reason, reasonOk, onStatus, onCommitted }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<ImportSourceType>("primary");
  const [sheetName, setSheetName] = useState("");
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  // Operator's mapping delta, keyed by the *normalized* source header so it
  // shares key-space with the backend's remembered mapping ("" ⇒ raw_data).
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  // True when the operator has edited the mapping since the last preview. Commit
  // is blocked until a re-scan folds those edits into the stored job mapping.
  const [mappingDirty, setMappingDirty] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [confirmImpact, setConfirmImpact] = useState<ImportCommitEstimate["impact"] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const hasOverrides = Object.keys(overrides).length > 0;
  const fieldOptions = CANONICAL_FIELDS[sourceType];

  function resetMapping() {
    setPreview(null);
    setOverrides({});
    setMappingDirty(false);
  }

  function pickFile(f: File | null) {
    setFile(f);
    resetMapping();
  }

  function editOverride(normalized: string, canonical: string) {
    setOverrides((prev) => ({ ...prev, [normalized]: canonical }));
    setMappingDirty(true);
  }

  async function runPreview(withOverrides: boolean) {
    if (!file) return;
    setPreviewing(true);
    try {
      const res = await sa.importPreview(tenantId, {
        file,
        source_type: sourceType,
        sheet_name: sheetName.trim() || undefined,
        overrides: withOverrides && hasOverrides ? overrides : undefined,
      });
      setPreview(res);
      setMappingDirty(false);
      onStatus(
        res.parse_error
          ? `Preview: ${res.parse_error}`
          : `Preview ready — ${res.importable_rows}/${res.total_rows} rows importable`,
      );
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function openCommit() {
    if (!preview || !reasonOk || mappingDirty) return;
    setCommitting(true);
    try {
      // Estimate off the stored job mapping (no overrides) — exactly what a real
      // commit will do — so the confirm dialog shows the true impact.
      const est = await sa.importCommit(tenantId, {
        job_id: preview.job_id,
        reason,
        dry_run: true,
      });
      setConfirmImpact(est.impact);
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Could not estimate import");
    } finally {
      setCommitting(false);
    }
  }

  async function doCommit() {
    if (!preview) return;
    setCommitting(true);
    try {
      const res = await sa.importCommit(tenantId, {
        job_id: preview.job_id,
        reason,
        dry_run: false,
      });
      setConfirmImpact(null);
      if (res.status === "completed") {
        onStatus(
          `Imported ${res.rows_inserted.toLocaleString("en-IN")} rows` +
            (res.rows_skipped ? ` (${res.rows_skipped} skipped)` : "") +
            (res.mapping_remembered ? " · mapping remembered" : ""),
        );
        setFile(null);
        resetMapping();
        await onCommitted();
      } else {
        onStatus(`Import failed: ${res.errors?.[0] ?? "no rows inserted"}`);
      }
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Commit failed");
    } finally {
      setCommitting(false);
    }
  }

  const canCommit = !!preview?.can_commit;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Assisted import</p>
        <p className="text-xs text-sa-muted">
          Upload a customer file, confirm the column mapping, then commit. Superadmin imports
          bypass the tenant upload quota but still record rows.
        </p>
      </div>

      {/* ── Step 1: file + source type ─────────────────────────────────── */}
      <div className="space-y-2">
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInput.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            pickFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded border border-dashed px-4 py-6 text-center text-xs transition-colors",
            dragActive ? "border-sa-accent bg-sa-accent/5" : "border-sa-border bg-sa-raised/40",
          )}
        >
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <span className="font-medium text-sa-text">{file.name}</span>
          ) : (
            <span className="text-sa-muted">Drop a CSV / Excel file here, or click to browse</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sourceType}
            onChange={(e) => {
              setSourceType(e.target.value as ImportSourceType);
              resetMapping();
            }}
            className="rounded border border-sa-border bg-sa-raised px-2 py-1 text-xs"
          >
            {(Object.keys(SOURCE_LABELS) as ImportSourceType[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
          <input
            value={sheetName}
            onChange={(e) => setSheetName(e.target.value)}
            placeholder="Sheet name (Excel, optional)"
            className="rounded border border-sa-border bg-sa-raised px-2 py-1 text-xs"
          />
          <Button
            type="button"
            size="sm"
            loading={previewing}
            disabled={!file || previewing}
            onClick={() => void runPreview(false)}
          >
            {preview ? "Re-scan file" : "Preview"}
          </Button>
        </div>
      </div>

      {/* ── Step 2: review mapping + counts ────────────────────────────── */}
      {preview && (
        <div className="space-y-3 border-t border-sa-border pt-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">{preview.total_rows.toLocaleString("en-IN")} rows</Badge>
            <Badge variant="outline" className="text-emerald-400">
              {preview.importable_rows.toLocaleString("en-IN")} importable
            </Badge>
            {preview.dropped_rows > 0 && (
              <Badge variant="outline" className="text-amber-400">
                {preview.dropped_rows.toLocaleString("en-IN")} dropped
              </Badge>
            )}
            {preview.remembered_mapping_applied && (
              <Badge variant="outline" className="text-sa-accent">
                remembered mapping
              </Badge>
            )}
          </div>

          {preview.parse_error && <p className="text-xs text-red-400">{preview.parse_error}</p>}
          {preview.mapping.missing_required.length > 0 && (
            <p className="text-xs text-red-400">
              Missing required: {preview.mapping.missing_required.join(", ")} — map a column below,
              then re-scan.
            </p>
          )}

          {/* Mapping editor */}
          <div className="overflow-x-auto rounded border border-sa-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-sa-raised">
                <tr>
                  <th className="px-2 py-1 text-left font-medium">Source column</th>
                  <th className="px-2 py-1 text-left font-medium">Maps to</th>
                  <th className="px-2 py-1 text-left font-medium">Via</th>
                </tr>
              </thead>
              <tbody>
                {[...preview.mapping.mapped, ...preview.mapping.unmapped].map((col) => {
                  const edited = overrides[col.normalized];
                  const current =
                    edited ?? ("canonical" in col ? (col as { canonical: string }).canonical : "");
                  const via = "via" in col ? (col as { via: string }).via : undefined;
                  return (
                    <tr key={col.source} className="border-t border-sa-border">
                      <td className="max-w-[160px] truncate px-2 py-1" title={col.source}>
                        {col.source}
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={current}
                          onChange={(e) => editOverride(col.normalized, e.target.value)}
                          className="w-full rounded border border-sa-border bg-sa-bg px-1 py-0.5"
                        >
                          <option value="">(leave in raw_data)</option>
                          {fieldOptions.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1 text-sa-muted">
                        {edited !== undefined ? "you" : via ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {mappingDirty && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={previewing}
                onClick={() => void runPreview(true)}
              >
                Re-scan with mapping changes
              </Button>
              <span className="text-xs text-amber-400">
                Unapplied mapping changes — re-scan to update counts before committing.
              </span>
            </div>
          )}

          <SampleRows rows={preview.sample_rows} />

          <div className="flex items-center gap-2 border-t border-sa-border pt-3">
            <Button
              type="button"
              size="sm"
              loading={committing}
              disabled={!canCommit || !reasonOk || mappingDirty || committing}
              onClick={() => void openCommit()}
            >
              Commit import
            </Button>
            {!reasonOk && (
              <span className="text-xs text-amber-400">Add a reason (above) to commit.</span>
            )}
            {reasonOk && !mappingDirty && !canCommit && (
              <span className="text-xs text-sa-muted">
                Nothing importable yet — fix the mapping.
              </span>
            )}
          </div>
        </div>
      )}

      {confirmImpact && (
        <ConfirmDialog
          open
          destructive={false}
          confirmLabel="Commit import"
          confirmPhrase="IMPORT"
          onOpenChange={() => setConfirmImpact(null)}
          title="Commit import"
          description={`Insert ${confirmImpact.importable_rows.toLocaleString(
            "en-IN",
          )} rows into this tenant's ${confirmImpact.source_type} data. The confirmed mapping will be remembered for this file shape.`}
          loading={committing}
          impactPreview={
            <ul className="space-y-0.5 text-xs">
              <li>Total rows in file: {confirmImpact.total_rows.toLocaleString("en-IN")}</li>
              <li className="text-emerald-400">
                Importable: {confirmImpact.importable_rows.toLocaleString("en-IN")}
              </li>
              {confirmImpact.dropped_rows > 0 && (
                <li className="text-amber-400">
                  Dropped: {confirmImpact.dropped_rows.toLocaleString("en-IN")}
                </li>
              )}
              {confirmImpact.parse_error && (
                <li className="text-red-400">{confirmImpact.parse_error}</li>
              )}
            </ul>
          }
          onConfirm={() => void doCommit()}
        />
      )}
    </div>
  );
}

function SampleRows({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = useMemo(
    () => (rows[0] != null ? Object.keys(rows[0]).slice(0, 6) : []),
    [rows],
  );
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs text-sa-muted">Sample of parsed rows (canonical fields)</p>
      <div className="max-h-48 overflow-auto rounded border border-sa-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-sa-raised">
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-2 py-1 text-left font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((row, ri) => (
              <tr key={ri} className="border-t border-sa-border">
                {columns.map((c) => (
                  <td key={c} className="max-w-[120px] truncate px-2 py-1">
                    {String(row[c] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
