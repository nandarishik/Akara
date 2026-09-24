import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import type { RecommendedAction } from "@/features/intelligence/api/types";

export function RecommendedActionsList({ actions }: { actions: RecommendedAction[] }) {
  if (actions.length === 0) return null;
  return (
    <GlowSurfaceCard padding="md" hover={false} className="space-y-2">
      <h3 className="text-sm font-semibold">Recommended actions</h3>
      <ol className="list-decimal pl-5 space-y-2 text-sm text-text-secondary">
        {actions.slice(0, 3).map((a) => (
          <li key={a.title}>
            <span className="font-medium text-text-primary">{a.title}</span>
            {a.detail ? ` — ${a.detail}` : ""}
          </li>
        ))}
      </ol>
    </GlowSurfaceCard>
  );
}
