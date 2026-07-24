import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ZoneBreakdown } from "@/types/kpi";
import { toNum } from "@/lib/format";

const COLORS = ["#0f172a", "#334155", "#64748b", "#94a3b8", "#cbd5e1"];

interface Props {
  data: ZoneBreakdown[];
}

export function ZoneChart({ data }: Props) {
  // Coerce Decimal strings from FastAPI to numbers
  const normalized = data.map((z) => ({ ...z, revenue_pct: toNum(z.revenue_pct), revenue: toNum(z.revenue) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={normalized.slice(0, 5)}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} />
        <YAxis
          dataKey="zone"
          type="category"
          tick={{ fontSize: 11, fill: "#64748b" }}
          width={60}
        />
        <Tooltip
          formatter={(v: any) => [`${toNum(Number(v) || 0).toFixed(1)}%`, "Revenue share"]}
        />
        <Bar dataKey="revenue_pct" radius={[0, 4, 4, 0]}>
          {normalized.slice(0, 5).map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
