import { formatINR, toNum } from "@/lib/format";

import type { EvidenceItem } from "../types";

export type EvidenceDrillDownProps = {
  evidence: EvidenceItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatValue(item: EvidenceItem): string {
  const unit = item.unit;
  const value = item.value;
  if (unit === "INR") return formatINR(value);
  if (unit === "pct") return `${toNum(value)}%`;
  if (unit === "ratio") return toNum(value).toFixed(2);
  if (value === null || value === undefined || value === "") return "—";
  return unit ? `${value} ${unit}` : String(value);
}

export function EvidenceDrillDown({ evidence, open, onOpenChange }: EvidenceDrillDownProps) {
  return (
    <div>
      <button
        type="button"
        className="text-sm font-medium text-accent hover:underline"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        {open ? "Hide evidence" : "Show evidence"}
      </button>
      {open ? (
        <ul className="mt-2 space-y-2 text-sm">
          {evidence.map((item, i) => (
            <li key={`${item.label}-${i}`} className="flex justify-between gap-3 text-text-secondary">
              <span>
                <span className="mr-2 rounded bg-white/5 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-text-muted">
                  {item.type || "—"}
                </span>
                {item.label || "—"}
              </span>
              <span className="shrink-0 text-text-primary">{formatValue(item)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-text-muted">
          {evidence.length} evidence {evidence.length === 1 ? "item" : "items"}
        </p>
      )}
    </div>
  );
}
