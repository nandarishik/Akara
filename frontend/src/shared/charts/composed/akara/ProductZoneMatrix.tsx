import { formatINRCompact } from "@/lib/format";
import type { HeatmapCellRow } from "@/lib/charts/chartAdapters";

const CELL_COLORS = [
  "rgba(255, 255, 255, 0.06)",
  "#004D56",
  "#007A87",
  "#00A3B4",
  "#00BCD4",
] as const;

function cellLevel(revenue: number, maxRev: number): number {
  if (revenue <= 0) return 0;
  return Math.min(4, Math.max(1, Math.round((revenue / maxRev) * 4)));
}

interface Props {
  rows: HeatmapCellRow[];
  loading?: boolean;
  className?: string;
}

export function ProductZoneMatrix({ rows, loading, className }: Props) {
  if (loading && rows.length === 0) {
    return (
      <div className={`h-[220px] skeleton rounded-lg ${className ?? ""}`} aria-label="Loading matrix" />
    );
  }

  if (rows.length === 0) {
    return (
      <div
        className={`flex h-[220px] items-center justify-center text-sm text-text-muted ${className ?? ""}`}
      >
        No product × zone activity yet
      </div>
    );
  }

  const products = [...new Set(rows.map((r) => r.product_name).filter(Boolean))].slice(0, 8);
  const zones = [...new Set(rows.map((r) => r.zone).filter(Boolean))].slice(0, 6);
  const maxRev = Math.max(...rows.map((r) => r.revenue), 1);

  if (products.length === 0 || zones.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-text-muted">
        No product × zone activity yet
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-[#0a0a0a] p-2 text-left font-medium text-text-muted">
                Product
              </th>
              {zones.map((zone) => (
                <th key={zone} className="p-2 text-center font-medium text-text-muted">
                  {zone}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product} className="border-t border-white/5">
                <td className="sticky left-0 max-w-[140px] truncate bg-[#0a0a0a] p-2 font-medium text-white/90">
                  {product}
                </td>
                {zones.map((zone) => {
                  const cell = rows.find(
                    (r) => r.product_name === product && r.zone === zone,
                  );
                  const revenue = cell?.revenue ?? 0;
                  const level = cellLevel(revenue, maxRev);
                  return (
                    <td key={zone} className="p-1.5">
                      <div
                        className="flex h-9 min-w-[52px] items-center justify-center rounded text-[10px] font-medium text-white/85"
                        style={{ backgroundColor: CELL_COLORS[level] }}
                        title={
                          revenue > 0
                            ? `${product} · ${zone}: ${formatINRCompact(revenue)}`
                            : `${product} · ${zone}: no activity`
                        }
                      >
                        {revenue > 0 ? formatINRCompact(revenue) : "—"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-text-muted">
        <span>Less</span>
        <div className="flex gap-1">
          {CELL_COLORS.map((color, i) => (
            <span
              key={i}
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
