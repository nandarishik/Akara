import { useState } from "react";

import type { CafeChannel, ChannelUpsert } from "@/features/data-import/api/types";
import GlowCTAButton from "@/shared/ui/GlowCTAButton";
import { toast } from "@/shared/ui/toast";
import { formatApiError } from "@/lib/formatApiError";

type Props = {
  channels: CafeChannel[];
  onSave: (row: ChannelUpsert) => Promise<void>;
};

const CHANNEL_TYPES = [
  "dine-in",
  "takeaway",
  "delivery",
  "aggregator",
  "online",
  "other",
] as const;

export function ChannelRateEditor({ channels, onSave }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("aggregator");
  const [rate, setRate] = useState("0");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast.error("Channel name is required");
      return;
    }
    setBusy(true);
    try {
      await onSave({
        channel_name: name.trim(),
        channel_type: type,
        commission_rate: Number(rate) || 0,
      });
      setName("");
      setRate("0");
      toast.success("Channel saved");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-white">Channel commission rates</h3>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-text-muted">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Commission %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {channels.map((ch) => (
              <tr key={ch.channel_id}>
                <td className="px-3 py-2 text-white">{ch.channel_name}</td>
                <td className="px-3 py-2 text-text-muted">{ch.channel_type}</td>
                <td className="px-3 py-2 text-text-muted">{ch.commission_rate}</td>
              </tr>
            ))}
            {channels.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-text-muted text-center">
                  No channels yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
          placeholder="Channel name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {CHANNEL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.1"
          className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
          placeholder="Commission %"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
      </div>
      <GlowCTAButton type="button" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Save channel"}
      </GlowCTAButton>
    </div>
  );
}
