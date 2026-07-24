import { useState, useRef, useEffect } from "react";
import { 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Database, 
  Clock, 
  Loader2, 
  PlayCircle, 
  PauseCircle, 
  RotateCcw,
  Trash2,
  Eye,
  Activity,
  BarChart3,
  Plus
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isAdmin } from "@/lib/auth-utils";
import SurfaceCard from "@/components/ui/SurfaceCard";
import { AkaraButton, SecondaryButton } from "@/components/ui/GradientButton";
import { TableSkeleton } from "@/components/ui/ShimmerSkeleton";
import { NoDataEmptyState } from "@/components/ui/EmptyState";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { PlanGate } from "@/components/billing/PlanGate";
import { useBilling } from "@/hooks/useBilling";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/toast";
import { formatApiError } from "@/lib/formatApiError";

interface ImportResult {
  rows_inserted: number;
  rows_skipped: number;
  errors: string[];
  warnings: string[];
}

interface ImportJob {
  id: string;
  filename: string;
  source_type: string;
  file_size: number;
  estimated_rows: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress_pct: number;
  rows_inserted?: number;
  rows_skipped?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

interface DailyUsage {
  date: string;
  imports: number;
  rows_imported: number;
  storage_mb: number;
}

type SourceType = "primary" | "secondary" | "scheme";

const BASE = import.meta.env.VITE_API_BASE_URL as string;

async function uploadFile(
  file: File,
  sourceType: SourceType,
  useAsync: boolean = false,
  onProgress: (p: number) => void
): Promise<ImportResult | { job_id: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const formData = new FormData();
  formData.append("file", file);

  // Choose endpoint based on file size or user preference
  const endpoint = useAsync || file.size > 5 * 1024 * 1024 
    ? `${BASE}/data/import/async?source_type=${sourceType}`
    : `${BASE}/data/import?source_type=${sourceType}`;

  // Simulate animated progress since fetch doesn't expose upload progress
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

  if (!res.ok) {
    throw new Error(`Failed to fetch jobs: ${res.status}`);
  }

  const data_result = await res.json();
  return data_result.jobs || [];
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

async function fetchDailyUsage(): Promise<DailyUsage[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return [];

  // Generate mock daily usage data for the last 7 days
  const usage: DailyUsage[] = [];
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    usage.push({
      date: date.toISOString().slice(0, 10),
      imports: Math.floor(Math.random() * 5) + 1,
      rows_imported: Math.floor(Math.random() * 10000) + 1000,
      storage_mb: Math.floor(Math.random() * 100) + 10
    });
  }
  
  return usage;
}

interface UploadPanelProps {
  title: string;
  description: string;
  columns: string[];
  sourceType: SourceType;
  isAdmin: boolean;
  onJobCreated: () => void;
  uploadDisabled?: boolean;
  onUploadComplete?: () => void;
}

function UploadPanel({
  title,
  description,
  columns,
  sourceType,
  isAdmin,
  onJobCreated,
  uploadDisabled = false,
  onUploadComplete,
}: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | { job_id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useAsync, setUseAsync] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file || !isAdmin || uploadDisabled) return;
    setUploading(true);
    setProgress(0);
    setResult(null);
    setError(null);
    
    try {
      const shouldUseAsync = useAsync || file.size > 5 * 1024 * 1024;
      const r = await uploadFile(file, sourceType, shouldUseAsync, setProgress);
      
      setResult(r);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      
      if ('job_id' in r) {
        toast.success('File queued for processing! Check import history below.');
        onJobCreated();
      } else {
        toast.success(`${r.rows_inserted} rows imported successfully!`);
      }
      onUploadComplete?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : formatApiError(err, "Upload failed");
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setResult(null);
    setError(null);
    setProgress(0);
    
    // Auto-enable async for large files
    if (selected && selected.size > 5 * 1024 * 1024) {
      setUseAsync(true);
    }
  }

  return (
    <SurfaceCard padding="md">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-h2 mb-2">{title}</h3>
        <p className="text-body text-sm">{description}</p>
      </div>

      {/* Drop Zone */}
      <div
        onClick={() => isAdmin && inputRef.current?.click()}
        className={`border-2 border-dashed border-surface-border rounded-xl p-8 text-center transition-all duration-300 ${
          isAdmin
            ? "cursor-pointer hover:border-accent hover:bg-accent-soft"
            : "cursor-not-allowed opacity-50"
        } ${file ? "border-accent bg-accent-soft" : ""}`}
      >
        <div
          className={`w-12 h-12 mx-auto mb-3 rounded-lg flex items-center justify-center ${
            file ? "bg-accent text-white" : "bg-surface-raised text-accent"
          }`}
        >
          <Upload className="h-6 w-6" />
        </div>
        <p className="text-text-primary font-medium">
          {file ? file.name : "Click to select file or drag & drop"}
        </p>
        <p className="text-caption text-xs mt-2">
          {file
            ? `${(file.size / 1024 / 1024).toFixed(2)} MB ${file.size > 5 * 1024 * 1024 ? '(Large file - will use async processing)' : ''}`
            : ".xlsx, .xls, .csv — max 50 MB"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
          disabled={!isAdmin}
        />
      </div>

      {/* Async Toggle */}
      {file && file.size <= 5 * 1024 * 1024 && (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => setUseAsync(!useAsync)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
              useAsync
                ? "bg-accent-soft border border-accent/30 text-accent"
                : "border border-surface-border text-text-secondary hover:bg-surface-raised"
            }`}
          >
            <Activity className="h-4 w-4" />
            Background Processing
          </button>
          <span className="text-xs text-caption">
            {useAsync ? 'Will process in background' : 'Will process immediately'}
          </span>
        </div>
      )}

      {/* Progress Bar */}
      {uploading && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-xs text-text-secondary">
            <span>Importing...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-surface-raised rounded-full h-2">
            <div
              className="h-2 rounded-full bg-accent transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="mt-6">
        {uploadDisabled && (
          <p className="text-xs text-amber-600 mb-2 text-center">
            Upload limit reached — resets tomorrow at midnight IST
          </p>
        )}
        <AkaraButton
          onClick={handleUpload}
          disabled={!file || uploading || !isAdmin || uploadDisabled}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {useAsync ? 'Queueing...' : 'Importing...'}
            </>
          ) : (
            <>
              <Database className="h-4 w-4 mr-2" />
              {useAsync ? 'Queue Import' : 'Import Data'}
            </>
          )}
        </AkaraButton>
      </div>

      {/* Error State */}
      {error && (
        <SurfaceCard padding="sm" className="mt-4 border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-red-700 font-medium">Import failed</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
        </SurfaceCard>
      )}

      {/* Success State */}
      {result && (
        <SurfaceCard padding="sm" className="mt-4 border-emerald-200 bg-emerald-50">
          {'job_id' in result ? (
            <div className="flex items-center gap-3">
              <PlayCircle className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-emerald-400 font-medium">Queued for processing</p>
                <p className="text-emerald-300 text-sm mt-1">
                  Job ID: <code className="bg-emerald-500/10 px-1 rounded text-xs">{result.job_id}</code>
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                <p className="text-emerald-400 font-medium">
                  <AnimatedNumber value={result.rows_inserted} /> rows imported
                  {result.rows_skipped > 0 && (
                    <span className="text-emerald-300 ml-2">
                      · {result.rows_skipped} skipped
                    </span>
                  )}
                </p>
              </div>
              {result.errors && result.errors.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium text-red-400">
                    {result.errors.length} errors
                  </summary>
                  <ul className="mt-2 space-y-1 pl-4 list-disc text-red-300">
                    {result.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
              {result.warnings && result.warnings.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium text-amber-400">
                    {result.warnings.length} warnings
                  </summary>
                  <ul className="mt-2 space-y-1 pl-4 list-disc text-amber-300">
                    {result.warnings.slice(0, 10).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </SurfaceCard>
      )}

      {/* Expected Columns */}
      <details className="mt-4">
        <summary className="cursor-pointer font-medium text-text-secondary text-sm flex items-center gap-2 select-none hover:text-accent transition-colors">
          <FileText className="h-4 w-4" /> 
          Expected columns ({columns.length})
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {columns.map((col, i) => (
            <code
              key={col}
              className="px-2 py-1 rounded text-xs font-mono bg-accent-soft text-text-secondary animate-fadeInUp"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              {col}
            </code>
          ))}
        </div>
      </details>
    </SurfaceCard>
  );
}

export function DataPage() {
  const { user, session } = useAuth();
  const isAdminUser = isAdmin(user, session);
  const { data: billing, refetch: refetchBilling } = useBilling();
  const queryClient = useQueryClient();
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [, setLoadingUsage] = useState(false);

  // Poll for job updates every 5 seconds
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    const loadJobs = async () => {
      if (!isAdminUser) return;
      setLoadingJobs(true);
      try {
        const jobs = await fetchImportJobs();
        setImportJobs(jobs);
      } catch (err) {
        console.error('Failed to load jobs:', err);
      } finally {
        setLoadingJobs(false);
      }
    };

    const loadUsage = async () => {
      setLoadingUsage(true);
      try {
        const usage = await fetchDailyUsage();
        setDailyUsage(usage);
      } catch (err) {
        console.error('Failed to load usage:', err);
      } finally {
        setLoadingUsage(false);
      }
    };

    // Initial load
    loadJobs();
    loadUsage();

    // Polling for active jobs
    const hasActiveJobs = importJobs.some(job => job.status === 'pending' || job.status === 'processing');
    if (hasActiveJobs) {
      interval = setInterval(loadJobs, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAdminUser, importJobs.length]);

  const handleJobCreated = () => {
    // Refresh the jobs list when a new job is created
    setTimeout(async () => {
      try {
        const jobs = await fetchImportJobs();
        setImportJobs(jobs);
      } catch (err) {
        console.error('Failed to refresh jobs:', err);
      }
    }, 1000);
    void refetchBilling();
    queryClient.invalidateQueries({ queryKey: ["billing", "usage"] });
  };

  const handleUploadComplete = () => {
    void refetchBilling();
    queryClient.invalidateQueries({ queryKey: ["billing", "usage"] });
  };

  const uploadsToday = billing?.uploads_today ?? 0;
  const uploadsPerDay = billing?.uploads_per_day ?? 3;
  const undosToday = billing?.undos_today ?? 0;
  const undosPerDay = billing?.undos_per_day ?? 2;
  const uploadAtLimit = uploadsToday >= uploadsPerDay;
  const undoAtLimit = undosToday >= undosPerDay;

  const [undoingJobId, setUndoingJobId] = useState<string | null>(null);

  async function handleUndoImport(jobId: string) {
    if (undoAtLimit) return;
    setUndoingJobId(jobId);
    try {
      await undoImport(jobId);
      toast.success("Import undone");
      const jobs = await fetchImportJobs();
      setImportJobs(jobs);
      void refetchBilling();
      queryClient.invalidateQueries({ queryKey: ["billing", "usage"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Undo failed");
    } finally {
      setUndoingJobId(null);
    }
  }

  const totalRowsToday = dailyUsage[dailyUsage.length - 1]?.rows_imported || 0;
  const totalImportsToday = dailyUsage[dailyUsage.length - 1]?.imports || 0;
  const totalStorageUsed = dailyUsage.reduce((sum, day) => sum + day.storage_mb, 0);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto bg-surface-canvas">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-display">Data Command Center</h1>
          <p className="text-body mt-2">
            Import primary sales, secondary DMS data, and scheme master with real-time processing
          </p>
        </div>

        {/* Daily Counters */}
        <div className="flex gap-4">
          <SurfaceCard hover={false} padding="sm" className="text-center min-w-[100px]">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-accent" />
              <span className="text-xs text-caption">Today</span>
            </div>
            <div className="text-lg font-bold text-text-primary">
              <AnimatedNumber value={totalImportsToday} />
            </div>
            <div className="text-xs text-caption">imports</div>
          </SurfaceCard>

          <SurfaceCard hover={false} padding="sm" className="text-center min-w-[100px]">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-accent" />
              <span className="text-xs text-caption">Rows</span>
            </div>
            <div className="text-lg font-bold text-text-primary">
              <AnimatedNumber value={totalRowsToday} />
            </div>
            <div className="text-xs text-caption">processed</div>
          </SurfaceCard>

          <SurfaceCard hover={false} padding="sm" className="text-center min-w-[100px]">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4 text-accent" />
              <span className="text-xs text-caption">Storage</span>
            </div>
            <div className="text-lg font-bold text-text-primary">
              <AnimatedNumber value={totalStorageUsed} />
            </div>
            <div className="text-xs text-caption">MB</div>
          </SurfaceCard>
        </div>
      </div>

      {/* Admin Warning */}
      {!isAdminUser && (
        <SurfaceCard padding="sm" className="border-amber-200 bg-amber-50">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-amber-800 font-medium">Admin access required</p>
              <p className="text-amber-700 text-sm">Contact your administrator to import data files.</p>
            </div>
          </div>
        </SurfaceCard>
      )}

      {/* Upload Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <UploadPanel
          title="Primary Sales (ERP / Tally)"
          description="Dispatch invoices from Tally or your ERP. What you shipped to distributors."
          sourceType="primary"
          isAdmin={isAdminUser}
          onJobCreated={handleJobCreated}
          onUploadComplete={handleUploadComplete}
          uploadDisabled={uploadAtLimit}
          columns={[
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
          ]}
        />

        <PlanGate
          feature="secondary_sales"
          requiredPlan="pro"
          title="Secondary Sales Import"
          description="Unlock DMS offtake data and scheme master uploads."
          priceHint="From ₹7,999/month"
        >
        <UploadPanel
          title="Secondary Sales (DMS Offtake)"
          description="What distributors actually sold to retailers. Export from Bizom, Botree, FieldAssist, or your DMS."
          sourceType="secondary"
          isAdmin={isAdminUser}
          onJobCreated={handleJobCreated}
          onUploadComplete={handleUploadComplete}
          uploadDisabled={uploadAtLimit}
          columns={[
            "invoice_date",
            "party_name",
            "party_zone",
            "route",
            "product_name",
            "product_group",
            "quantity",
            "total_amount",
          ]}
        />
        </PlanGate>

        <PlanGate
          feature="secondary_sales"
          requiredPlan="pro"
          title="Scheme Master Import"
          description="Upload scheme claims to detect leakage vs secondary offtake."
        >
        <UploadPanel
          title="Scheme Master (Distributor Claims)"
          description="Scheme claims filed by distributors. Used to detect leakage vs. actual secondary offtake."
          sourceType="scheme"
          isAdmin={isAdminUser}
          onJobCreated={handleJobCreated}
          onUploadComplete={handleUploadComplete}
          uploadDisabled={uploadAtLimit}
          columns={[
            "scheme_name",
            "party_name",
            "product_name",
            "claimed_amount",
            "scheme_start",
            "scheme_end",
            "discount_pct (optional)",
          ]}
        />
        </PlanGate>

        {/* Slot G — upgrade nudge */}
        <SurfaceCard padding="sm" className="mt-4">
          <p className="text-sm text-body">
            Unlock secondary sales and scheme data —{" "}
            <span className="text-caption">From ₹7,999/month</span>
          </p>
          <Link to="/upgrade" className="text-sm font-semibold text-accent hover:underline mt-1 inline-block">
            View plans →
          </Link>
        </SurfaceCard>
      </div>

      {/* Import History Table */}
      <SurfaceCard padding="md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-accent" />
            <h2 className="text-h2">Import History</h2>
          </div>
          <SecondaryButton size="sm" onClick={handleJobCreated}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Refresh
          </SecondaryButton>
        </div>

        {loadingJobs ? (
          <TableSkeleton rows={5} />
        ) : importJobs.length === 0 ? (
          <NoDataEmptyState 
            title="No imports yet"
            description="Upload your first data file to get started"
            actionLabel="Upload File"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="text-left py-3 text-caption font-medium text-sm">File</th>
                  <th className="text-left py-3 text-caption font-medium text-sm">Type</th>
                  <th className="text-left py-3 text-caption font-medium text-sm">Status</th>
                  <th className="text-left py-3 text-caption font-medium text-sm">Progress</th>
                  <th className="text-left py-3 text-caption font-medium text-sm">Rows</th>
                  <th className="text-left py-3 text-caption font-medium text-sm">Started</th>
                  <th className="text-right py-3 text-caption font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {importJobs.slice(0, 10).map((job, i) => (
                  <tr 
                    key={job.id} 
                    className="border-b border-surface-border animate-fadeInUp hover:bg-surface-raised transition-colors"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <td className="py-4 text-text-primary font-medium truncate max-w-[200px]">
                      {job.filename}
                      <div className="text-xs text-text-secondary mt-1">
                        {(job.file_size / 1024 / 1024).toFixed(1)} MB
                      </div>
                    </td>
                    <td className="py-4">
                      <span className="inline-block px-2 py-1 rounded text-xs font-medium capitalize bg-accent-soft text-accent">
                        {job.source_type}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        {job.status === 'pending' && (
                          <>
                            <PauseCircle className="h-4 w-4 text-amber-400" />
                            <span className="text-amber-400 text-sm">Pending</span>
                          </>
                        )}
                        {job.status === 'processing' && (
                          <>
                            <Loader2 className="h-4 w-4 text-accent animate-spin" />
                            <span className="text-accent text-sm">Processing</span>
                          </>
                        )}
                        {job.status === 'completed' && (
                          <>
                            <CheckCircle className="h-4 w-4 text-emerald-400" />
                            <span className="text-emerald-400 text-sm">Completed</span>
                          </>
                        )}
                        {job.status === 'failed' && (
                          <>
                            <AlertCircle className="h-4 w-4 text-red-400" />
                            <span className="text-red-400 text-sm">Failed</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="w-20">
                        <div className="w-full bg-surface-raised rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              job.status === 'completed'
                                ? 'bg-emerald-500'
                                : job.status === 'failed'
                                ? 'bg-red-500'
                                : 'bg-accent'
                            }`}
                            style={{ width: `${job.progress_pct}%` }}
                          />
                        </div>
                        <div className="text-xs text-text-secondary mt-1">{job.progress_pct}%</div>
                      </div>
                    </td>
                    <td className="py-4 text-text-primary">
                      {job.rows_inserted ? (
                        <div>
                          <AnimatedNumber value={job.rows_inserted} className="font-medium" />
                          {job.rows_skipped ? (
                            <div className="text-xs text-text-secondary">
                              {job.rows_skipped} skipped
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-caption">—</span>
                      )}
                    </td>
                    <td className="py-4 text-text-secondary text-sm">
                      {new Date(job.created_at).toLocaleDateString()}
                      <div className="text-xs text-caption">
                        {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          className="p-1 text-text-muted hover:text-accent transition-colors"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {job.status === 'completed' && (
                          <button
                            type="button"
                            onClick={() => handleUndoImport(job.id)}
                            disabled={undoAtLimit || undoingJobId === job.id}
                            className="p-1 text-text-muted hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={
                              undoAtLimit
                                ? `${undosPerDay} undos used today. Resets tomorrow.`
                                : "Undo import"
                            }
                          >
                            {undoingJobId === job.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>

      {/* Ad Slot G - Data Enhancement */}
      <SurfaceCard padding="md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-accent text-white">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-h2">Data Enhancement Services</h3>
              <p className="text-body text-sm">
                Let our experts clean and enrich your data for better insights
              </p>
            </div>
          </div>
          <AkaraButton size="sm">
            Learn More
          </AkaraButton>
        </div>
      </SurfaceCard>
    </div>
  );
}
