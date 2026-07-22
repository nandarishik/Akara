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

interface Props {
  data: RevenueByDate[];
}

function formatINR(value: number): string {
  if (value >= 10_00_000) return `₹${(value / 10_00_000).toFixed(1)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(0)}K`;
  return `₹${value.toFixed(0)}`;
}

export function RevenueTrendChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="invoice_date"
          tick={{ fontSize: 12, fill: "#94a3b8" }}
          tickFormatter={(v) => v.slice(5)}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#94a3b8" }}
          tickFormatter={formatINR}
          width={60}
        />
        <Tooltip
          formatter={(v: number) => [formatINR(v), "Revenue"]}
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
