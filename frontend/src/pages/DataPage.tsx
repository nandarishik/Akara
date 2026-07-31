import { useState, useEffect } from "react";
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  RotateCcw,
  Trash2,
  Database,
  Layers,
  FileSpreadsheet,
  Lock,
  Upload,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { isAdmin } from "@/lib/auth-utils";
import GlowSurfaceCard from "@/components/ui/GlowSurfaceCard";
import GlowCTAButton from "@/components/ui/GlowCTAButton";
import { SecondaryButton } from "@/components/ui/GradientButton";
import { TableSkeleton } from "@/components/ui/ShimmerSkeleton";
import { NoDataEmptyState } from "@/components/ui/EmptyState";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { useBilling } from "@/hooks/useBilling";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/toast";
import { formatApiError } from "@/lib/formatApiError";
import { cn } from "@/lib/utils";
import { PromoDismissCard } from "@/components/promo/PromoDismissCard";
import { dismissSlot, isSlotDismissed, PLACEMENT_KEYS, SLOT_KEYS } from "@/lib/promoSlots";
import {
  DataUploadPanel,
  type ImportResult,
  type SourceType,
} from "@/components/data/DataUploadPanel";

interface ImportJob {
  id: string;
  filename: string;
  source_type: string;
  file_size: number;
  estimated_rows: number;
  status: "pending" | "queued" | "processing" | "completed" | "failed" | "cancelled";
  progress_pct: number;
  rows_inserted?: number;
  rows_skipped?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

const BASE = import.meta.env.VITE_API_BASE_URL as string;

const SOURCE_TABS: {
  id: SourceType;
  label: string;
  short: string;
  icon: typeof Database;
  requiresPro?: boolean;
}[] = [
  { id: "primary", label: "Primary sales", short: "ERP / Tally", icon: Database },
  { id: "secondary", label: "Secondary DMS", short: "Offtake", icon: Layers, requiresPro: true },
  { id: "scheme", label: "Scheme master", short: "Claims", icon: FileSpreadsheet, requiresPro: true },
];

const SOURCE_COPY: Record<
  SourceType,
  { title: string; subtitle: string; columns: string[] }
> = {
  primary: {
    title: "Primary sales",
    subtitle: "Dispatch invoices from Tally or your ERP — what you shipped to distributors.",
    columns: [
      "invoice_date",
      "invoice_number",
      "party_name",
      "party_city",
      "party_zone",
      "route",
      "product_name",
      "product_group",
      "quantity",
      "gross_amount",
      "discount_amount",
      "net_amount",
      "tax_amount",
      "total_amount",
      "outstanding_amount (optional)",
    ],
  },
  secondary: {
    title: "Secondary sales",
    subtitle: "DMS offtake from Bizom, Botree, FieldAssist — what retailers actually bought.",
    columns: [
      "invoice_date",
      "party_name",
      "party_zone",
      "route",
      "product_name",
      "product_group",
      "quantity",
      "total_amount",
    ],
  },
  scheme: {
    title: "Scheme master",
    subtitle: "Distributor scheme claims — used to detect leakage vs secondary offtake.",
    columns: [
      "scheme_name",
      "party_name",
      "product_name",
      "claimed_amount",
      "scheme_start",
      "scheme_end",
      "discount_pct (optional)",
    ],
  },
};

async function uploadFile(
  file: File,
  sourceType: SourceType,
  useAsync: boolean,
  onProgress: (p: number) => void
): Promise<ImportResult | { job_id: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const formData = new FormData();
  formData.append("file", file);
  const endpoint =
    useAsync || file.size > 5 * 1024 * 1024
      ? `${BASE}/data/import/async?source_type=${sourceType}`
      : `${BASE}/data/import?source_type=${sourceType}`;

  let simulatedProgress = 0;
  const progressInterval = setInterval(() => {
    simulatedProgress = Math.min(85, simulatedProgress + Math.random() * 12 + 3);
    onProgress(Math.round(simulatedProgress));
  }, 200);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    clearInterval(progressInterval);
    onProgress(100);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(formatApiError(errData.detail, `Upload failed (${res.status})`));
    }
    return res.json();
  } catch (err) {
    clearInterval(progressInterval);
    throw err;
  }
}

async function fetchImportJobs(): Promise<ImportJob[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${BASE}/data/import/jobs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch jobs: ${res.status}`);
  const data_result = await res.json();
  return (data_result.jobs || []).map((j: Record<string, unknown>) => ({
    id: String(j.id),
    filename: String(j.filename || "upload"),
    source_type: String(j.source_type || "primary"),
    file_size: Number(j.file_size || 0),
    estimated_rows: Number(j.rows_inserted || 0),
    status: (j.status === "queued" ? "pending" : j.status) as ImportJob["status"],
    progress_pct: j.status === "processing" ? 50 : j.status === "completed" ? 100 : 0,
    rows_inserted: j.rows_inserted as number | undefined,
    rows_skipped: j.rows_skipped as number | undefined,
    error_message: j.error_message as string | undefined,
    created_at: String(j.created_at),
    completed_at: j.completed_at as string | undefined,
  }));
}

async function cancelImportJob(jobId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${BASE}/data/import/jobs/${jobId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(formatApiError(errData.detail, `Cancel failed (${res.status})`));
  }
}

async function retryImportJob(jobId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${BASE}/data/import/jobs/${jobId}/retry`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(formatApiError(errData.detail, `Retry failed (${res.status})`));
  }
}

async function undoImport(jobId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${BASE}/data/imports/${jobId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Undo failed: ${res.status}`);
  }
}

function StatusBadge({ status }: { status: ImportJob["status"] }) {
  const normalized = status === "queued" ? "pending" : status;
  const map = {
    pending: { label: "Queued", className: "bg-amber-400/15 text-amber-300 ring-amber-400/30" },
    processing: { label: "Processing", className: "bg-accent/15 text-accent ring-accent/30" },
    completed: { label: "Done", className: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30" },
    failed: { label: "Failed", className: "bg-red-400/15 text-red-300 ring-red-400/30" },
    cancelled: { label: "Cancelled", className: "bg-neutral-400/15 text-neutral-300 ring-neutral-400/30" },
  } as const;
  const s = map[normalized as keyof typeof map] ?? map.pending;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1", s.className)}>
      {normalized === "processing" && <Loader2 className="h-3 w-3 animate-spin" />}
      {normalized === "completed" && <CheckCircle className="h-3 w-3" />}
      {(normalized === "failed" || normalized === "cancelled") && <AlertCircle className="h-3 w-3" />}
      {s.label}
    </span>
  );
}

export function DataPage() {
  const { user, session } = useAuth();
  const isAdminUser = isAdmin(user, session);
  const { data: billing, refetch: refetchBilling } = useBilling();
  const queryClient = useQueryClient();
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [activeSource, setActiveSource] = useState<SourceType>("primary");
  const [undoingJobId, setUndoingJobId] = useState<string | null>(null);
  const [actionJobId, setActionJobId] = useState<string | null>(null);
  const [showProUpsell, setShowProUpsell] = useState(false);
  const [uploadKey, setUploadKey] = useState(0);

  const hasSecondary = billing?.features.secondary_sales ?? false;
  const uploadsToday = billing?.uploads_today ?? 0;
  const uploadsPerDay = billing?.uploads_per_day ?? 3;
  const undosToday = billing?.undos_today ?? 0;
  const undosPerDay = billing?.undos_per_day ?? 2;
  const uploadAtLimit = uploadsToday >= uploadsPerDay;
  const undoAtLimit = undosToday >= undosPerDay;

  useEffect(() => {
    if (!isAdminUser) return;
    let interval: ReturnType<typeof setInterval>;

    const loadJobs = async () => {
      setLoadingJobs(true);
      try {
        setImportJobs(await fetchImportJobs());
      } catch (err) {
        console.error("Failed to load jobs:", err);
      } finally {
        setLoadingJobs(false);
      }
    };

    loadJobs();
    const hasActive = importJobs.some(
      (j) => j.status === "pending" || j.status === "queued" || j.status === "processing"
    );
    if (hasActive) interval = setInterval(loadJobs, 5000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAdminUser, importJobs.length]);

  async function refreshJobs() {
    try {
      setImportJobs(await fetchImportJobs());
    } catch (err) {
      console.error("Failed to refresh jobs:", err);
    }
    void refetchBilling();
    queryClient.invalidateQueries({ queryKey: ["billing", "usage"] });
  }

  async function handleUpload(
    file: File,
    sourceType: SourceType,
    useAsync: boolean,
    onProgress: (p: number) => void
  ) {
    const r = await uploadFile(file, sourceType, useAsync, onProgress);
    if ("job_id" in r) {
      toast.success("File queued — see import history below.");
    } else {
      toast.success(`${r.rows_inserted} rows imported.`);
    }
    await refreshJobs();
    if (billing?.plan === "free" && !isSlotDismissed(SLOT_KEYS.G)) {
      setShowProUpsell(true);
    }
    return r;
  }

  async function handleCancelImport(jobId: string) {
    setActionJobId(jobId);
    try {
      await cancelImportJob(jobId);
      toast.success("Import cancelled");
      await refreshJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setActionJobId(null);
    }
  }

  async function handleRetryImport(jobId: string) {
    setActionJobId(jobId);
    try {
      await retryImportJob(jobId);
      toast.success("Import re-queued");
      await refreshJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setActionJobId(null);
    }
  }

  async function handleUndoImport(jobId: string) {
    if (undoAtLimit) return;
    setUndoingJobId(jobId);
    try {
      await undoImport(jobId);
      toast.success("Import undone");
      await refreshJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Undo failed");
    } finally {
      setUndoingJobId(null);
    }
  }

  const activeLocked =
    (activeSource === "secondary" || activeSource === "scheme") && !hasSecondary;
  const copy = SOURCE_COPY[activeSource];

  return (
    <div className="relative z-10 min-h-full">
      {/* Header band */}
      <div className="border-b border-white/10 bg-white/5 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-accent mb-2">
                <Upload className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-widest">Data</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
                Import center
              </h1>
              <p className="text-sm text-text-secondary mt-2 max-w-lg leading-relaxed">
                Upload sales files — AKARA maps columns automatically and powers your dashboard,
                copilot, and weekly debrief.
              </p>
            </div>

            {billing && (
              <div className="flex flex-wrap gap-3 sm:gap-4">
                {[
                  {
                    label: "Uploads today",
                    value: `${uploadsToday}/${uploadsPerDay}`,
                  },
                  {
                    label: "Rows stored",
                    value: billing.rows_limit === -1
                      ? billing.rows_used.toLocaleString("en-IN")
                      : `${(billing.rows_used / 1000).toFixed(0)}K / ${(billing.rows_limit / 1000).toFixed(0)}K`,
                  },
                  {
                    label: "Undos left",
                    value: `${undosPerDay - undosToday}`,
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl bg-white/5 px-4 py-2.5 min-w-[100px]"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-text-muted">{label}</p>
                    <p className="text-lg font-bold tabular-nums mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {!isAdminUser && (
          <GlowSurfaceCard accent="amber" padding="sm" hover={false}>
            <div className="text-sm flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
              Admin access required to import files.
            </div>
          </GlowSurfaceCard>
        )}

        {/* Source tabs */}
        <div className="flex flex-wrap gap-2 p-1 rounded-2xl bg-white/5 w-fit">
          {SOURCE_TABS.map(({ id, label, short, icon: Icon, requiresPro }) => {
            const locked = requiresPro && !hasSecondary;
            const active = activeSource === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveSource(id);
                  setUploadKey((k) => k + 1);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-white/10 text-white shadow-sm ring-1 ring-white/20"
                    : "text-white/70 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{short}</span>
                {locked && <Lock className="h-3 w-3 text-text-muted" />}
              </button>
            );
          })}
        </div>

        {/* Upload area — single panel */}
        <GlowSurfaceCard padding="lg" hover={false} className="shadow-card">
          {activeLocked ? (
            <div className="text-center py-12 px-4">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                <Lock className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold">Pro feature</h3>
              <p className="text-sm text-text-secondary mt-2 max-w-md mx-auto">
                Secondary DMS offtake and scheme master imports unlock on Pro and Business plans.
              </p>
              <div className="inline-block mt-6">
                <GlowCTAButton size="sm" to="/upgrade">View plans →</GlowCTAButton>
              </div>
            </div>
          ) : (
            <DataUploadPanel
              key={`${activeSource}-${uploadKey}`}
              title={copy.title}
              subtitle={copy.subtitle}
              columns={copy.columns}
              sourceType={activeSource}
              isAdmin={isAdminUser}
              uploadDisabled={uploadAtLimit}
              onUpload={handleUpload}
              onComplete={() => void refetchBilling()}
            />
          )}
        </GlowSurfaceCard>

        {showProUpsell && billing?.plan === "free" && (
          <PromoDismissCard
            slotKey={PLACEMENT_KEYS.G}
            title="Unlock secondary sales & scheme analysis"
            description="Pro plan adds DMS offtake imports and scheme leakage detection."
            ctaLabel="Upgrade to Pro →"
            ctaTo="/upgrade"
            accent="green"
            onDismiss={() => {
              dismissSlot(SLOT_KEYS.G);
              setShowProUpsell(false);
            }}
          />
        )}

        {/* Import history */}
        <GlowSurfaceCard padding="md" hover={false}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold">Recent imports</h2>
            </div>
            <SecondaryButton size="sm" onClick={() => void refreshJobs()}>
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Refresh
            </SecondaryButton>
          </div>

          {loadingJobs && importJobs.length === 0 ? (
            <TableSkeleton rows={3} />
          ) : importJobs.length === 0 ? (
            <NoDataEmptyState
              variant="folder"
              title="No imports yet"
              description="Your first upload will appear here with status and row counts."
            />
          ) : (
            <ul className="divide-y divide-white/10">
              {importJobs.slice(0, 8).map((job) => (
                <li
                  key={job.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{job.filename}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {new Date(job.created_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" · "}
                      {(job.file_size / 1024 / 1024).toFixed(1)} MB
                      {" · "}
                      <span className="capitalize">{job.source_type}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <StatusBadge status={job.status} />
                    {job.rows_inserted != null && (
                      <span className="text-sm font-semibold tabular-nums">
                        <AnimatedNumber value={job.rows_inserted} /> rows
                      </span>
                    )}
                    {job.status === "completed" && isAdminUser && (
                      <button
                        type="button"
                        onClick={() => void handleUndoImport(job.id)}
                        disabled={undoAtLimit || undoingJobId === job.id}
                        className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                        title={undoAtLimit ? "Daily undo limit reached" : "Undo import"}
                      >
                        {undoingJobId === job.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    {(job.status === "pending" || job.status === "queued" || job.status === "processing") && isAdminUser && (
                      <button
                        type="button"
                        onClick={() => void handleCancelImport(job.id)}
                        disabled={actionJobId === job.id}
                        className="text-xs font-medium text-red-400 hover:underline disabled:opacity-40"
                      >
                        Cancel
                      </button>
                    )}
                    {(job.status === "failed" || job.status === "cancelled") && isAdminUser && (
                      <button
                        type="button"
                        onClick={() => void handleRetryImport(job.id)}
                        disabled={actionJobId === job.id}
                        className="text-xs font-medium text-accent hover:underline disabled:opacity-40"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlowSurfaceCard>
      </div>
    </div>
  );
}
