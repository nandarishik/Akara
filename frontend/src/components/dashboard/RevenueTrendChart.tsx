import type { RevenueByDate } from "@/types/kpi";
import { RevenueAreaChart } from "@/components/charts/akara/RevenueAreaChart";

interface Props {
  data: RevenueByDate[];
  loading?: boolean;
}

/** @deprecated Use RevenueAreaChart directly */
export function RevenueTrendChart({ data, loading }: Props) {
  return <RevenueAreaChart data={data} loading={loading} />;
}

export { RevenueAreaChart };
