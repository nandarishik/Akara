import { useState } from "react";

import GlowCTAButton from "@/shared/ui/GlowCTAButton";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import {
  CAFE_METRICS,
  METRIC_LABELS,
  type CafeAlert,
  type CafeMetric,
  type EscalationLevel,
} from "@/features/intelligence/api/types";

import { ChannelToggles, type ChannelState } from "./ChannelToggles";

const PCT_METRICS = new Set<CafeMetric>(["food_cost_above_threshold"]);

export function AlertRuleModal({
  initial,
  whatsappDisabled,
  onClose,
  onSubmit,
  saving,
}: {
  initial?: CafeAlert | null;
  whatsappDisabled?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    metric: CafeMetric;
    condition: "below" | "above" | "equals";
    threshold: number;
    escalation_level: EscalationLevel;
    channel_email: boolean;
    channel_whatsapp: boolean;
    channel_in_app: boolean;
  }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [metric, setMetric] = useState<CafeMetric>(
    (initial?.metric as CafeMetric) ?? "revenue_below_threshold",
  );
  const [condition, setCondition] = useState<"below" | "above" | "equals">(
    (initial?.condition as "below" | "above" | "equals") ?? "below",
  );
  const [threshold, setThreshold] = useState(initial?.threshold ?? 10000);
  const [escalation, setEscalation] = useState<EscalationLevel>(
    initial?.escalation_level ?? "daily_digest",
  );
  const [channels, setChannels] = useState<ChannelState>({
    email: initial?.channel_email ?? true,
    whatsapp: initial?.channel_whatsapp ?? false,
    in_app: initial?.channel_in_app ?? true,
  });

  const unit = PCT_METRICS.has(metric) ? "%" : "₹";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <GlowSurfaceCard padding="md" className="w-full max-w-lg space-y-4" hover={false}>
        <h2 className="text-lg font-semibold">{initial ? "Edit alert" : "New café alert"}</h2>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              name,
              metric,
              condition,
              threshold,
              escalation_level: escalation,
              channel_email: channels.email,
              channel_whatsapp: channels.whatsapp,
              channel_in_app: channels.in_app,
            });
          }}
        >
          <input
            className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm"
            placeholder="Alert name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as CafeMetric)}
            className="w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm"
          >
            {CAFE_METRICS.map((m) => (
              <option key={m} value={m}>
                {METRIC_LABELS[m]}
              </option>
            ))}
          </select>
          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as typeof condition)}
              className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm"
            >
              <option value="below">falls below</option>
              <option value="above">rises above</option>
              <option value="equals">equals</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-text-muted">{unit}</span>
              <input
                type="number"
                className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                required
              />
            </label>
          </div>
          <select
            value={escalation}
            onChange={(e) => setEscalation(e.target.value as EscalationLevel)}
            className="w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm"
          >
            <option value="immediate">Immediate</option>
            <option value="daily_digest">Daily digest</option>
            <option value="weekly_trend">Weekly trend</option>
          </select>
          <ChannelToggles
            value={channels}
            onChange={setChannels}
            whatsappDisabled={whatsappDisabled}
          />
          <div className="flex gap-2 pt-2">
            <GlowCTAButton type="submit" size="sm" disabled={saving} loading={saving}>
              Save
            </GlowCTAButton>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-white/10 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </GlowSurfaceCard>
    </div>
  );
}
