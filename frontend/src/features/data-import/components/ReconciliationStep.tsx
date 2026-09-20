import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar } from "@visx/shape";
import { scaleLinear, scaleBand } from "@visx/scale";

import {
  confirmReconciliation,
  getReconciliation,
  undoImport,
} from "@/features/data-import/api/cafeImportApi";
import type { Reconciliation } from "@/features/data-import/api/types";
import { formatINR } from "@/lib/format";
import GlowCTAButton from "@/shared/ui/GlowCTAButton";
import { SecondaryButton } from "@/shared/ui/GradientButton";
import { toast } from "@/shared/ui/toast";
import { formatApiError } from "@/lib/formatApiError";

type Props = {
  importId: string;
  onDone: () => void;
};

function channelColor(channel: string): string {
  const c = channel.toLowerCase();
  if (c.includes("dine")) return "#3b82f6";
  if (c.includes("takeaway") || c.includes("take-away")) return "#22c55e";
  if (c.includes("swiggy") || c.includes("aggregator") || c.includes("delivery")) return "#f97316";
  if (c.includes("zomato")) return "#ef4444";
  return "#64748b";
}

export function ReconciliationStep({ importId, onDone }: Props) {
  const navigate = useNavigate();
  const [data, setData] = useState<Reconciliation | null>(null);
  const [showNo, setShowNo] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getReconciliation(importId)
      .then(setData)
      .catch((e) => toast.error(formatApiError(e)));
  }, [importId]);

  const width = 420;
  const height = Math.max(80, (data?.channels.length ?? 0) * 28);
  const yScale = useMemo(() => {
    if (!data) return null;
    return scaleBand({
      domain: data.channels.map((c) => c.channel),
      range: [0, height],
      padding: 0.25,
    });
  }, [data, height]);
  const xScale = useMemo(() => {
    if (!data) return null;
    const max = Math.max(...data.channels.map((c) => c.total_amount), 1);
    return scaleLinear({ domain: [0, max], range: [0, width - 120] });
  }, [data]);

  async function onYes() {
    setBusy(true);
    try {
      await confirmReconciliation(importId, { accepted: true, notes: null });
      onDone();
      navigate("/data");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onUndo() {
    setBusy(true);
    try {
      try {
        await confirmReconciliation(importId, {
          accepted: false,
          notes: notes || "undo",
          action: "undo",
        });
      } catch {
        await undoImport(importId);
      }
      onDone();
      navigate("/data");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onAcceptRounding() {
    setBusy(true);
    try {
      await confirmReconciliation(importId, {
        accepted: false,
        notes: notes || "accept_rounding",
        action: "accept_rounding",
      });
      onDone();
      navigate("/data");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <p className="text-sm text-text-muted">Loading reconciliation…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-white">Step 4 — Reconciliation</h2>
        <p className="text-sm text-text-muted mt-1">
          Compare imported totals with your POS before accepting.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <p className="text-text-muted">Orders</p>
          <p className="text-xl text-white font-semibold">{data.order_count}</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <p className="text-text-muted">Total</p>
          <p className="text-xl text-white font-semibold">{formatINR(data.total_amount)}</p>
        </div>
      </div>

      <p className="text-sm text-text-muted">
        {data.date_range_start
          ? `${new Date(data.date_range_start).toLocaleString("en-IN")} → ${
              data.date_range_end
                ? new Date(data.date_range_end).toLocaleString("en-IN")
                : "—"
            } (${data.span_days} days)`
          : "Date range unavailable"}
      </p>
      {data.span_alert && (
        <p className="text-sm text-amber-200">Date range exceeds 31 days</p>
      )}
      {data.totals_flag && (
        <p className="text-sm text-amber-200">
          Totals delta {data.totals_delta_pct}% exceeds 5% threshold
        </p>
      )}

      {yScale && xScale && data.channels.length > 0 && (
        <svg width={width} height={height} role="img" aria-label="Channel breakdown">
          {data.channels.map((ch) => {
            const y = yScale(ch.channel) ?? 0;
            const w = xScale(ch.total_amount) ?? 0;
            return (
              <g key={ch.channel}>
                <text x={0} y={y + (yScale.bandwidth() ?? 0) / 2} dy="0.35em" fill="#94a3b8" fontSize={11}>
                  {ch.channel}
                </text>
                <Bar
                  x={100}
                  y={y}
                  width={w}
                  height={yScale.bandwidth()}
                  fill={channelColor(ch.channel)}
                  rx={3}
                />
              </g>
            );
          })}
        </svg>
      )}

      <p className="text-sm text-text-muted">
        Quarantine rows: {data.quarantine_row_count}{" "}
        <Link className="text-accent hover:underline ml-2" to={`/data/quarantine?import_id=${importId}`}>
          Review quarantine
        </Link>
      </p>

      {!showNo ? (
        <div className="flex flex-wrap gap-3">
          <GlowCTAButton type="button" disabled={busy} onClick={() => void onYes()} data-testid="recon-yes">
            Yes — looks correct
          </GlowCTAButton>
          <SecondaryButton type="button" disabled={busy} onClick={() => setShowNo(true)} data-testid="recon-no">
            No — something is off
          </SecondaryButton>
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white min-h-[80px]"
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <SecondaryButton type="button" disabled={busy} onClick={() => void onUndo()} data-testid="recon-undo">
              Undo import
            </SecondaryButton>
            <SecondaryButton type="button" disabled={busy} onClick={() => void onAcceptRounding()}>
              Accept rounding
            </SecondaryButton>
            <a
              className="text-sm text-accent self-center hover:underline"
              href={`mailto:support@akara.ai?subject=${encodeURIComponent(`Import ${importId}`)}`}
            >
              Contact support
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
