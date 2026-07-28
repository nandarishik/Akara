import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, Download, MessageSquare, RefreshCw } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import SurfaceCard from "@/components/ui/SurfaceCard";
import { AkaraButton } from "@/components/ui/GradientButton";
import { Badge } from "@/components/ui/badge";
import { useBilling } from "@/hooks/useBilling";
import ShimmerSkeleton from "@/components/ui/ShimmerSkeleton";
import { daysSinceIso } from "@/lib/dataFreshness";

type DebriefItem = {
  title: string;
  detail: string;
  impact_inr?: number;
  hypothesis?: string;
  urgency?: string;
};

type DebriefMetadata = {
  headline: string;
  week_start: string;
  week_end: string;
  limited_mode: boolean;
  went_right: DebriefItem[];
  went_wrong: DebriefItem[];
  actions: DebriefItem[];
  momentum: {
    this_week_revenue_fmt: string;
    wow_change_pct: number;
    wow_direction: string;
    projected_month_fmt: string;
    trend_30d: string;
    trend_60d: string;
    trend_90d: string;
    avg_30d_daily?: number;
    avg_60d_daily?: number;
    avg_90d_daily?: number;
  };
  days_of_data: number;
  data_freshness?: string;
};

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

function formatInr(n: number) {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export function DebriefPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { data: usage } = useBilling();
  const [detail, setDetail] = useState<DebriefDetail | null>(null);
  const [archive, setArchive] = useState<DebriefSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [dataDays, setDataDays] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

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
  const lifetimeExhausted =
    usage?.plan === "free" &&
    usage.debrief_lifetime_limit > 0 &&
    usage.debrief_count_used >= usage.debrief_lifetime_limit &&
    archive.length === 0;

  const staleDays = meta?.data_freshness ? daysSinceIso(meta.data_freshness) : null;
  const isStale = staleDays !== null && staleDays > 7;

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
          <div className="flex gap-2 justify-center">
            <Link to="/data">
              <AkaraButton variant="secondary" size="sm">Go to Data →</AkaraButton>
            </Link>
            <AkaraButton variant="secondary" size="sm" onClick={() => loadReport()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </AkaraButton>
          </div>
        </SurfaceCard>
      </div>
    );
  }

  if (!meta) return null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 bg-surface-canvas min-h-full">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-accent" />
            Weekly Debrief
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {meta.week_start} – {meta.week_end}
          </p>
        </div>
        <div className="flex gap-2">
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
            <AkaraButton variant="secondary" size="sm" onClick={downloadPdf} disabled={pdfLoading}>
              <Download className="h-4 w-4 mr-1" />
              {pdfLoading ? "Downloading…" : "Download"}
            </AkaraButton>
          )}
        </div>
      </div>

      {isStale && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Data is {staleDays} days old — upload fresh sales data for sharper insights.
        </div>
      )}

      {meta.limited_mode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Limited mode — you have {meta.days_of_data} days of data. Full week-over-week sections unlock at 14+ days.
        </div>
      )}

      <SurfaceCard>
        <p className="text-lg font-semibold text-text-primary">{meta.headline}</p>
      </SurfaceCard>

      <SurfaceCard>
        <h2 className="font-semibold mb-4">Momentum</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="rounded-lg bg-surface-raised p-3">
            <p className="text-xs text-text-muted">This week</p>
            <p className="font-bold">{meta.momentum?.this_week_revenue_fmt ?? "—"}</p>
          </div>
          <div className="rounded-lg bg-surface-raised p-3">
            <p className="text-xs text-text-muted">WoW</p>
            <p className="font-bold">{meta.momentum?.wow_change_pct ?? 0}%</p>
          </div>
          <div className="rounded-lg bg-surface-raised p-3">
            <p className="text-xs text-text-muted">Month projection</p>
            <p className="font-bold">{meta.momentum?.projected_month_fmt ?? "—"}</p>
          </div>
          <div className="rounded-lg bg-surface-raised p-3">
            <p className="text-xs text-text-muted">30-day trend</p>
            <p className="font-bold capitalize">{meta.momentum?.trend_30d ?? "—"}</p>
          </div>
          <div className="rounded-lg bg-surface-raised p-3">
            <p className="text-xs text-text-muted">60-day trend</p>
            <p className="font-bold capitalize">{meta.momentum?.trend_60d ?? "—"}</p>
          </div>
          <div className="rounded-lg bg-surface-raised p-3">
            <p className="text-xs text-text-muted">90-day trend</p>
            <p className="font-bold capitalize">{meta.momentum?.trend_90d ?? "—"}</p>
          </div>
        </div>
      </SurfaceCard>

      <div className="grid md:grid-cols-2 gap-4">
        <SurfaceCard>
          <h2 className="font-semibold text-emerald-700 mb-3">Went Right</h2>
          <ul className="space-y-3">
            {meta.went_right?.map((item, i) => (
              <li key={i} className="text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="text-text-secondary mt-0.5">{item.detail}</p>
                {item.impact_inr ? (
                  <Badge variant="outline" className="mt-1 text-xs">{formatInr(item.impact_inr)}</Badge>
                ) : null}
              </li>
            ))}
          </ul>
        </SurfaceCard>
        <SurfaceCard>
          <h2 className="font-semibold text-red-700 mb-3">Went Wrong</h2>
          <ul className="space-y-3">
            {meta.went_wrong?.map((item, i) => (
              <li key={i} className="text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="text-text-secondary mt-0.5">{item.detail}</p>
                {item.hypothesis && (
                  <p className="text-xs text-text-muted mt-1">{item.hypothesis}</p>
                )}
              </li>
            ))}
          </ul>
        </SurfaceCard>
      </div>

      <SurfaceCard>
        <h2 className="font-semibold mb-3">Actions this week</h2>
        <ol className="list-decimal list-inside space-y-2">
          {meta.actions?.map((action, i) => (
            <li key={i} className="text-sm">
              <span className="font-medium">{action.title}</span>
              {" — "}
              {action.detail}
              {action.urgency && (
                <Badge variant="outline" className="ml-2 text-xs capitalize">{action.urgency}</Badge>
              )}
            </li>
          ))}
        </ol>
      </SurfaceCard>

      {archive.length > 1 && (
        <SurfaceCard>
          <h2 className="font-semibold mb-3">Past debriefs</h2>
          <ul className="space-y-2">
            {archive.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => loadReport(item.id)}
                  className={`text-sm text-left w-full py-2 px-3 rounded-lg hover:bg-surface-raised ${
                    selectedId === item.id ? "bg-accent-soft text-accent" : ""
                  }`}
                >
                  {item.week_start} – {item.week_end}: {item.headline}
                </button>
              </li>
            ))}
          </ul>
        </SurfaceCard>
      )}
    </div>
  );
}
