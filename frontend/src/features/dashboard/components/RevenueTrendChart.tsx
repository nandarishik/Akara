import type { RevenueByDate } from "@/types/kpi";
import { RevenueAreaChart } from "@/shared/charts/composed/akara/RevenueAreaChart";

interface Props {
  data: RevenueByDate[];
  loading?: boolean;
}

/** @deprecated Use RevenueAreaChart directly */
export function RevenueTrendChart({ data, loading }: Props) {
  return <RevenueAreaChart data={data} loading={loading} />;
}

export { RevenueAreaChart };
