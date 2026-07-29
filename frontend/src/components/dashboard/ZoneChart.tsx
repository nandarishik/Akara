import type { ZoneBreakdown } from "@/types/kpi";
import { ZoneBarChart } from "@/components/charts/akara/ZoneBarChart";

interface Props {
  data: ZoneBreakdown[];
  loading?: boolean;
}

/** @deprecated Use ZoneBarChart directly */
export function ZoneChart({ data, loading }: Props) {
  return (
    <ZoneBarChart
      data={data}
      loading={loading}
      horizontal={false}
      className="h-full min-h-[192px]"
      aspectRatio={null}
    />
  );
}

export { ZoneBarChart };
