import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, Download, MessageSquare, RefreshCw } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { isAdmin } from "@/lib/auth-utils";
import SurfaceCard from "@/components/ui/SurfaceCard";
import { AkaraButton } from "@/components/ui/GradientButton";
import { useBilling } from "@/hooks/useBilling";
import ShimmerSkeleton from "@/components/ui/ShimmerSkeleton";
import { daysSinceIso } from "@/lib/dataFreshness";
import { cn } from "@/lib/utils";
import {
  DebriefReportView,
  type DebriefMetadata,
} from "@/components/debrief/DebriefReportView";

type DebriefDetail = {
  id: string;
  title: string;
  metadata: DebriefMetadata;
  created_at: string;
};

type DebriefSummary = {
  id: string;
  title: string;
  week_start: string;
  week_end: string;
  headline: string;
  limited_mode: boolean;
};

export function DebriefPage() {
  const navigate = useNavigate();
  const { session, user } = useAuth();
  const { data: usage } = useBilling();
  const [detail, setDetail] = useState<DebriefDetail | null>(null);
  const [archive, setArchive] = useState<DebriefSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [dataDays, setDataDays] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState("");

  async function loadReport(id?: string) {
    setLoading(true);
    setError("");
    setErrorCode("");
    try {
      const path = id ? `/debrief/${id}` : "/debrief/latest";
      const data = await apiFetch<DebriefDetail>(path);
      setDetail(data);
      setSelectedId(data.id);
    } catch (e) {
      setDetail(null);
      const msg = e instanceof Error ? e.message : "Could not load debrief";
      setError(msg);
      try {
        const parsed = JSON.parse(msg.replace(/^API \d+: /, ""));
        if (parsed?.detail?.code) setErrorCode(parsed.detail.code);
      } catch {
        if (msg.includes("no_debrief_yet")) setErrorCode("no_debrief_yet");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
    apiFetch<DebriefSummary[]>("/debrief")
      .then(setArchive)
      .catch(() => setArchive([]));
  }, []);

  useEffect(() => {
    if (errorCode !== "no_debrief_yet") return;
    apiFetch<{ start?: string; end?: string }>("/kpi/data-bounds")
      .then((bounds) => {
        if (!bounds.start || !bounds.end) {
          setDataDays(0);
          return;
        }
        const start = new Date(bounds.start);
        const end = new Date(bounds.end);
        const days =
          Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        setDataDays(days);
      })
      .catch(() => setDataDays(null));
  }, [errorCode]);

  async function generateDebrief() {
    setGenerating(true);
    setGenerateMsg("");
    try {
      const res = await apiFetch<{ status: string; message?: string; report_id?: string }>(
        "/debrief/generate",
        { method: "POST" },
      );
      setGenerateMsg(res.message || (res.status === "ok" ? "Weekly debrief generated." : res.status));
      if (res.status === "ok" && res.report_id) {
        await loadReport(res.report_id);
        const list = await apiFetch<DebriefSummary[]>("/debrief");
        setArchive(list);
      }
    } catch (e) {
      setGenerateMsg(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setGenerating(false);
    }
  }

  async function downloadPdf() {
    if (!detail || !session?.access_token) return;
    setPdfLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/debrief/${detail.id}/pdf`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (!res.ok) throw new Error("PDF download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `debrief-${detail.metadata.week_start}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF download failed");
    } finally {
      setPdfLoading(false);
    }
  }

  const meta = detail?.metadata;
  const canAskCopilot = usage?.features.ask_copilot_debrief;
  const adminCanGenerate = isAdmin(user, session) && dataDays !== null && dataDays >= 7;
  const lifetimeExhausted =
    usage?.plan === "free" &&
    usage.debrief_lifetime_limit > 0 &&
    usage.debrief_count_used >= usage.debrief_lifetime_limit &&
    archive.length === 0;

  const staleDays = meta?.data_freshness ? daysSinceIso(meta.data_freshness) : null;
  const isStale = staleDays !== null && staleDays > 7;
  const dataEndsBeforeDebriefWeek =
    meta?.data_freshness &&
    meta?.week_start &&
    meta.data_freshness.slice(0, 10) < meta.week_start.slice(0, 10);

  if (loading && !detail) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <ShimmerSkeleton className="h-8 w-48" />
        <ShimmerSkeleton className="h-32 w-full rounded-xl" />
        <div className="grid md:grid-cols-2 gap-4">
          <ShimmerSkeleton className="h-48 w-full rounded-xl" />
          <ShimmerSkeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (lifetimeExhausted) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <SurfaceCard className="text-center space-y-4">
          <BarChart3 className="h-10 w-10 mx-auto text-text-muted" />
          <h1 className="text-xl font-bold">Free debrief used</h1>
          <p className="text-sm text-text-secondary">
            Your one lifetime weekly debrief has been sent. Upgrade to Pro for debriefs every Monday.
          </p>
          <Link to="/billing">
            <AkaraButton size="sm">Upgrade to Pro →</AkaraButton>
          </Link>
        </SurfaceCard>
      </div>
    );
  }

  if (error && !detail) {
    const underSeven = dataDays !== null && dataDays > 0 && dataDays < 7;
    const waitingForMonday = dataDays !== null && dataDays >= 7;

    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <SurfaceCard className="text-center space-y-4">
          <BarChart3 className="h-10 w-10 mx-auto text-text-muted" />
          {underSeven ? (
            <>
              <h1 className="text-xl font-bold">Almost ready for your first debrief</h1>
              <p className="text-sm text-text-secondary">
                You have {dataDays} day{dataDays === 1 ? "" : "s"} of sales data. Upload at least 7 days
                to unlock your first weekly debrief — it generates next Monday at 7:00 AM IST.
              </p>
            </>
          ) : waitingForMonday ? (
            <>
              <h1 className="text-xl font-bold">First debrief coming Monday</h1>
              <p className="text-sm text-text-secondary">
                Your data looks good ({dataDays} days). Your first weekly debrief will generate next
                Monday at 7:00 AM IST, or when an admin triggers one manually.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold">No weekly debrief yet</h1>
              <p className="text-sm text-text-secondary">
                Upload at least 7 days of sales data. Your first debrief generates next Monday at 7:00 AM IST,
                or when an admin triggers one.
              </p>
            </>
          )}
          <div className="flex flex-wrap gap-2 justify-center">
            <Link to="/data">
              <AkaraButton variant="secondary" size="sm">Go to Data →</AkaraButton>
            </Link>
            {adminCanGenerate && (
              <AkaraButton size="sm" onClick={() => void generateDebrief()} disabled={generating}>
                <RefreshCw className={`h-4 w-4 mr-1 ${generating ? "animate-spin" : ""}`} />
                {generating ? "Generating…" : "Generate debrief now"}
              </AkaraButton>
            )}
            <AkaraButton variant="secondary" size="sm" onClick={() => loadReport()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </AkaraButton>
          </div>
          {generateMsg && <p className="text-sm text-text-secondary">{generateMsg}</p>}
        </SurfaceCard>
      </div>
    );
  }

  if (!meta) return null;

  return (
    <div className="min-h-full bg-surface-canvas">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {dataEndsBeforeDebriefWeek && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This debrief covers {meta.week_start} – {meta.week_end}, but your latest sale is{" "}
            {meta.data_freshness?.slice(0, 10)} — KPIs may show ₹0 until you upload recent data
            and regenerate.
          </div>
        )}

        {isStale && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Data is {staleDays} days old — upload fresh sales for sharper insights.
          </div>
        )}

        {meta.limited_mode && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Limited mode ({meta.days_of_data} days of data). Full comparisons unlock at 14+ days.
          </div>
        )}

        <DebriefReportView
          meta={meta as DebriefMetadata}
          headerActions={
            <>
              {canAskCopilot && detail && (
                <AkaraButton
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    navigate("/copilot", { state: { debriefReportId: detail.id } })
                  }
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Ask Copilot
                </AkaraButton>
              )}
              {detail && (
                <AkaraButton
                  variant="secondary"
                  size="sm"
                  onClick={downloadPdf}
                  disabled={pdfLoading}
                >
                  <Download className="h-4 w-4 mr-1" />
                  {pdfLoading ? "…" : "PDF"}
                </AkaraButton>
              )}
            </>
          }
        />

        {archive.length > 1 && (
          <SurfaceCard padding="md" hover={false}>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
              Past weeks
            </h2>
            <div className="flex flex-wrap gap-2">
              {archive.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => loadReport(item.id)}
                  className={cn(
                    "text-left rounded-full px-4 py-2 text-sm transition-colors max-w-full truncate",
                    selectedId === item.id
                      ? "bg-accent text-white"
                      : "bg-surface-raised text-text-secondary hover:bg-accent-soft hover:text-accent"
                  )}
                >
                  {item.week_start.slice(5)} – {item.week_end.slice(5)}
                </button>
              ))}
            </div>
          </SurfaceCard>
        )}
      </div>
    </div>
  );
}
