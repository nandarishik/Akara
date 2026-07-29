import { RadarChart, RadarGrid, RadarAxis, RadarLabels, RadarArea } from "@/charts";
import { toZoneRadar } from "@/lib/charts/chartAdapters";
import type { ZoneBreakdown } from "@/types/kpi";

interface Props {
  zones: ZoneBreakdown[];
  className?: string;
}

export function ZoneRadarChart({ zones, className }: Props) {
  const { data, metrics } = toZoneRadar(zones);

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted">
        Need zone data for comparison
      </div>
    );
  }

  return (
    <RadarChart className={className} data={data} metrics={metrics} size={320}>
      <RadarGrid />
      <RadarAxis />
      <RadarLabels />
      {data.map((item, index) => (
        <RadarArea key={item.label} index={index} />
      ))}
    </RadarChart>
  );
}
