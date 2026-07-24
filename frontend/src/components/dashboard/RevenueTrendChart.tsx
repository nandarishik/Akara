import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { RevenueByDate } from "@/types/kpi";
import { toNum, formatINRCompact } from "@/lib/format";

interface Props {
  data: RevenueByDate[];
}

// Coerce data to ensure Decimal strings from FastAPI are handled properly
function normalize(d: RevenueByDate[]) {
  return d.map((r) => ({ ...r, revenue: toNum(r.revenue), orders: toNum(r.orders) }));
}

export function RevenueTrendChart({ data }: Props) {
  const normalized = normalize(data);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={normalized} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="invoice_date"
          tick={{ fontSize: 12, fill: "#94a3b8" }}
          tickFormatter={(v) => v.slice(5)}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#94a3b8" }}
          tickFormatter={formatINRCompact}
          width={60}
        />
        <Tooltip
          formatter={(v: any) => [formatINRCompact(Number(v) || 0), "Revenue"]}
          labelStyle={{ color: "#1e293b" }}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#0f172a"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#0f172a" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
