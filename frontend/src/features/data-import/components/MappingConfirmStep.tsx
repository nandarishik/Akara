import { useCallback, useEffect, useMemo, useState } from "react";

import { confirmMapping, getMappingProposal } from "@/features/data-import/api/cafeImportApi";
import {
  EXPENSE_CANONICAL_FIELDS,
  INVENTORY_CANONICAL_FIELDS,
  ORDER_CANONICAL_FIELDS,
  type MappingBand,
  type MappingColumn,
  type MappingProposal,
} from "@/features/data-import/api/types";
import GlowCTAButton from "@/shared/ui/GlowCTAButton";
import { toast } from "@/shared/ui/toast";
import { formatApiError } from "@/lib/formatApiError";
import { cn } from "@/lib/utils";

type Props = {
  importId: string;
  onConfirmed: () => void;
};

function fieldsForType(importType: string): readonly string[] {
  if (importType === "cafe_expenses") return EXPENSE_CANONICAL_FIELDS;
  if (importType === "cafe_inventory") return INVENTORY_CANONICAL_FIELDS;
  return ORDER_CANONICAL_FIELDS;
}

function bandClass(band: MappingBand): string {
  switch (band) {
    case "accepted":
      return "text-emerald-300";
    case "suggested":
      return "text-sky-300";
    case "uncertain":
      return "text-amber-300";
    default:
      return "text-text-muted";
  }
}

export function MappingConfirmStep({ importId, onConfirmed }: Props) {
  const [proposal, setProposal] = useState<MappingProposal | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const p = await getMappingProposal(importId);
    setProposal(p);
    const init: Record<string, string> = {};
    for (const col of p.columns) {
      init[col.raw_column] = col.canonical_field ?? "";
    }
    setOverrides(init);
    return p;
  }, [importId]);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 15; // 30s @ 2s
    async function poll() {
      try {
        const p = await load();
        if (cancelled) return;
        if (p.status !== "mapping_proposed" && attempts < maxAttempts) {
          attempts += 1;
          window.setTimeout(() => void poll(), 2000);
        }
      } catch (e) {
        if (cancelled) return;
        if (attempts < maxAttempts) {
          attempts += 1;
          window.setTimeout(() => void poll(), 2000);
        } else {
          setPollError(formatApiError(e));
        }
      }
    }
    void poll();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const fieldOptions = useMemo(
    () => (proposal ? fieldsForType(proposal.import_type) : ORDER_CANONICAL_FIELDS),
    [proposal],
  );

  const mappedRequired = useMemo(() => {
    if (!proposal) return new Set<string>();
    const mapped = new Set(
      Object.values(overrides).filter((v) => v && v.length > 0),
    );
    return mapped;
  }, [overrides, proposal]);

  const confirmDisabled = useMemo(() => {
    if (!proposal) return true;
    return proposal.required_fields.some((f) => !mappedRequired.has(f));
  }, [proposal, mappedRequired]);

  async function onConfirm() {
    if (!proposal || confirmDisabled) return;
    setBusy(true);
    try {
      const mappings = Object.entries(overrides)
        .filter(([, canonical_field]) => canonical_field)
        .map(([raw_column, canonical_field]) => ({ raw_column, canonical_field }));
      await confirmMapping(importId, { mappings });
      onConfirmed();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (pollError) {
    return <p className="text-sm text-red-300">{pollError}</p>;
  }
  if (!proposal) {
    return <p className="text-sm text-text-muted">Waiting for mapping proposal…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-white">Step 2 — Confirm column mapping</h2>
        <p className="text-sm text-text-muted mt-1">
          Always review before import. Confirm stays disabled until every required field is mapped.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Raw</th>
              <th className="px-3 py-2 font-medium">Suggested</th>
              <th className="px-3 py-2 font-medium">Confidence</th>
              <th className="px-3 py-2 font-medium">Override</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {proposal.columns.map((col: MappingColumn) => (
              <tr key={col.raw_column}>
                <td className="px-3 py-2 text-white">{col.raw_column}</td>
                <td className={cn("px-3 py-2", bandClass(col.band))}>
                  {col.canonical_field ?? "—"}{" "}
                  <span className="text-xs opacity-70">({col.band})</span>
                </td>
                <td className="px-3 py-2 text-text-muted">
                  {col.confidence == null ? "—" : col.confidence.toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  <select
                    className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-white"
                    value={overrides[col.raw_column] ?? ""}
                    onChange={(e) =>
                      setOverrides((prev) => ({
                        ...prev,
                        [col.raw_column]: e.target.value,
                      }))
                    }
                  >
                    <option value="">Unmapped</option>
                    {fieldOptions.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <GlowCTAButton
        type="button"
        disabled={confirmDisabled || busy}
        onClick={() => void onConfirm()}
        data-testid="mapping-confirm"
      >
        {busy ? "Confirming…" : "Confirm mapping"}
      </GlowCTAButton>
      {confirmDisabled && (
        <p className="text-xs text-amber-200">
          Required still unmapped:{" "}
          {proposal.required_fields.filter((f) => !mappedRequired.has(f)).join(", ")}
        </p>
      )}
    </div>
  );
}
