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
import LiquidGlassCard from "@/components/ui/LiquidGlassCard";
import GradientButton, { SecondaryButton } from "@/components/ui/GradientButton";
import { TableSkeleton } from "@/components/ui/ShimmerSkeleton";
import { NoDataEmptyState } from "@/components/ui/EmptyState";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/toast";

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
      throw new Error(errData.detail || `Upload failed: ${res.status}`);
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
}

function UploadPanel({
  title,
  description,
  columns,
  sourceType,
  isAdmin,
  onJobCreated,
}: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | { job_id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useAsync, setUseAsync] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sourceColors = {
    primary: { border: '#1565C0', bg: 'rgba(21, 101, 192, 0.05)', accent: '#42A5F5' },
    secondary: { border: '#0288D1', bg: 'rgba(2, 136, 209, 0.05)', accent: '#29B6F6' },
    scheme: { border: '#7B1FA2', bg: 'rgba(123, 31, 162, 0.05)', accent: '#AB47BC' }
  };

  const colors = sourceColors[sourceType] || sourceColors.primary;

  async function handleUpload() {
    if (!file || !isAdmin) return;
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
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
    <LiquidGlassCard className="p-6" style={{ borderColor: colors.border + '20' }}>
      {/* Header */}
      <div className="mb-6">
        <h3 
          className="text-lg font-semibold bg-clip-text text-transparent mb-2"
          style={{
            backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #90CAF9 100%)'
          }}
        >
          {title}
        </h3>
        <p className="text-[#90CAF9] text-sm">{description}</p>
      </div>

      {/* Blue Gradient Drop Zone */}
      <div
        onClick={() => isAdmin && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
          isAdmin
            ? "cursor-pointer hover:border-[#42A5F5] hover:bg-[rgba(66,165,245,0.05)]"
            : "cursor-not-allowed opacity-50"
        }`}
        style={{
          borderColor: file ? colors.accent : 'rgba(33, 150, 243, 0.2)',
          backgroundColor: file ? colors.bg : 'transparent'
        }}
      >
        <div 
          className="w-12 h-12 mx-auto mb-3 rounded-lg flex items-center justify-center"
          style={{
            background: file 
              ? `linear-gradient(135deg, ${colors.border} 0%, ${colors.accent} 100%)`
              : 'rgba(15, 52, 96, 0.6)',
            boxShadow: file ? `0 8px 32px ${colors.accent}40` : 'none'
          }}
        >
          <Upload className={`h-6 w-6 ${file ? 'text-white' : 'text-[#42A5F5]'}`} />
        </div>
        <p className="text-[#E3F2FD] font-medium">
          {file ? file.name : "Click to select file or drag & drop"}
        </p>
        <p className="text-[#90CAF9] text-xs mt-2">
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
                ? 'bg-[rgba(66,165,245,0.1)] border border-[#42A5F5]/30 text-[#42A5F5]'
                : 'border border-[rgba(33,150,243,0.12)] text-[#90CAF9] hover:bg-[rgba(66,165,245,0.05)]'
            }`}
          >
            <Activity className="h-4 w-4" />
            Background Processing
          </button>
          <span className="text-xs text-[#5C8FBF]">
            {useAsync ? 'Will process in background' : 'Will process immediately'}
          </span>
        </div>
      )}

      {/* Blue Gradient Progress Bar */}
      {uploading && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-xs text-[#90CAF9]">
            <span>Importing...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-[rgba(15,52,96,0.6)] rounded-full h-2">
            <div 
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 50%, #80D8FF 100%)',
                boxShadow: '0 0 8px rgba(66, 165, 245, 0.4)'
              }}
            />
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="mt-6">
        <GradientButton
          onClick={handleUpload}
          disabled={!file || uploading || !isAdmin}
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
        </GradientButton>
      </div>

      {/* Error State */}
      {error && (
        <LiquidGlassCard className="mt-4 p-4 border-red-500/20 bg-red-500/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-red-400 font-medium">Import failed</p>
              <p className="text-red-300 text-sm mt-1">{error}</p>
            </div>
          </div>
        </LiquidGlassCard>
      )}

      {/* Success State */}
      {result && (
        <LiquidGlassCard className="mt-4 p-4 border-emerald-500/20 bg-emerald-500/5">
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
        </LiquidGlassCard>
      )}

      {/* Expected Columns */}
      <details className="mt-4">
        <summary className="cursor-pointer font-medium text-[#90CAF9] text-sm flex items-center gap-2 select-none hover:text-[#42A5F5] transition-colors">
          <FileText className="h-4 w-4" /> 
          Expected columns ({columns.length})
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {columns.map((col, i) => (
            <code
              key={col}
              className={`px-2 py-1 rounded text-xs font-mono animate-fadeInUp`}
              style={{
                backgroundColor: 'rgba(66, 165, 245, 0.1)',
                color: '#90CAF9',
                animationDelay: `${i * 30}ms`
              }}
            >
              {col}
            </code>
          ))}
        </div>
      </details>
    </LiquidGlassCard>
  );
}

export function DataPage() {
  const { user, session } = useAuth();
  const isAdminUser = isAdmin(user, session);
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
  };

  const totalRowsToday = dailyUsage[dailyUsage.length - 1]?.rows_imported || 0;
  const totalImportsToday = dailyUsage[dailyUsage.length - 1]?.imports || 0;
  const totalStorageUsed = dailyUsage.reduce((sum, day) => sum + day.storage_mb, 0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 
            className="text-3xl font-bold bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #90CAF9 100%)'
            }}
          >
            Data Command Center
          </h1>
          <p className="text-[#90CAF9] mt-2">
            Import primary sales, secondary DMS data, and scheme master with real-time processing
          </p>
        </div>

        {/* Daily Counters */}
        <div className="flex gap-4">
          <LiquidGlassCard hover={false} className="px-4 py-3 text-center min-w-[100px]">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-[#42A5F5]" />
              <span className="text-xs text-[#90CAF9]">Today</span>
            </div>
            <div className="text-lg font-bold text-[#E3F2FD]">
              <AnimatedNumber value={totalImportsToday} />
            </div>
            <div className="text-xs text-[#5C8FBF]">imports</div>
          </LiquidGlassCard>

          <LiquidGlassCard hover={false} className="px-4 py-3 text-center min-w-[100px]">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-[#42A5F5]" />
              <span className="text-xs text-[#90CAF9]">Rows</span>
            </div>
            <div className="text-lg font-bold text-[#E3F2FD]">
              <AnimatedNumber value={totalRowsToday} />
            </div>
            <div className="text-xs text-[#5C8FBF]">processed</div>
          </LiquidGlassCard>

          <LiquidGlassCard hover={false} className="px-4 py-3 text-center min-w-[100px]">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4 text-[#42A5F5]" />
              <span className="text-xs text-[#90CAF9]">Storage</span>
            </div>
            <div className="text-lg font-bold text-[#E3F2FD]">
              <AnimatedNumber value={totalStorageUsed} />
            </div>
            <div className="text-xs text-[#5C8FBF]">MB</div>
          </LiquidGlassCard>
        </div>
      </div>

      {/* Admin Warning */}
      {!isAdminUser && (
        <LiquidGlassCard className="p-4 border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-amber-400 font-medium">Admin access required</p>
              <p className="text-amber-300 text-sm">Contact your administrator to import data files.</p>
            </div>
          </div>
        </LiquidGlassCard>
      )}

      {/* Upload Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <UploadPanel
          title="Primary Sales (ERP / Tally)"
          description="Dispatch invoices from Tally or your ERP. What you shipped to distributors."
          sourceType="primary"
          isAdmin={isAdminUser}
          onJobCreated={handleJobCreated}
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

        <UploadPanel
          title="Secondary Sales (DMS Offtake)"
          description="What distributors actually sold to retailers. Export from Bizom, Botree, FieldAssist, or your DMS."
          sourceType="secondary"
          isAdmin={isAdminUser}
          onJobCreated={handleJobCreated}
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

        <UploadPanel
          title="Scheme Master (Distributor Claims)"
          description="Scheme claims filed by distributors. Used to detect leakage vs. actual secondary offtake."
          sourceType="scheme"
          isAdmin={isAdminUser}
          onJobCreated={handleJobCreated}
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
      </div>

      {/* Import History Table */}
      <LiquidGlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-[#42A5F5]" />
            <h2 
              className="text-lg font-semibold bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #90CAF9 100%)'
              }}
            >
              Import History
            </h2>
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
                <tr className="border-b border-[rgba(33,150,243,0.08)]">
                  <th className="text-left py-3 text-[#90CAF9] font-medium text-sm">File</th>
                  <th className="text-left py-3 text-[#90CAF9] font-medium text-sm">Type</th>
                  <th className="text-left py-3 text-[#90CAF9] font-medium text-sm">Status</th>
                  <th className="text-left py-3 text-[#90CAF9] font-medium text-sm">Progress</th>
                  <th className="text-left py-3 text-[#90CAF9] font-medium text-sm">Rows</th>
                  <th className="text-left py-3 text-[#90CAF9] font-medium text-sm">Started</th>
                  <th className="text-right py-3 text-[#90CAF9] font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {importJobs.slice(0, 10).map((job, i) => (
                  <tr 
                    key={job.id} 
                    className={`border-b border-[rgba(33,150,243,0.05)] animate-fadeInUp hover:bg-[rgba(66,165,245,0.02)] transition-colors`}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <td className="py-4 text-[#E3F2FD] font-medium truncate max-w-[200px]">
                      {job.filename}
                      <div className="text-xs text-[#90CAF9] mt-1">
                        {(job.file_size / 1024 / 1024).toFixed(1)} MB
                      </div>
                    </td>
                    <td className="py-4">
                      <span 
                        className="inline-block px-2 py-1 rounded text-xs font-medium capitalize"
                        style={{
                          backgroundColor: job.source_type === 'primary' ? 'rgba(21, 101, 192, 0.1)' :
                                           job.source_type === 'secondary' ? 'rgba(2, 136, 209, 0.1)' :
                                           'rgba(123, 31, 162, 0.1)',
                          color: job.source_type === 'primary' ? '#42A5F5' :
                                 job.source_type === 'secondary' ? '#29B6F6' :
                                 '#AB47BC'
                        }}
                      >
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
                            <Loader2 className="h-4 w-4 text-[#42A5F5] animate-spin" />
                            <span className="text-[#42A5F5] text-sm">Processing</span>
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
                        <div className="w-full bg-[rgba(15,52,96,0.6)] rounded-full h-2">
                          <div 
                            className="h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${job.progress_pct}%`,
                              background: job.status === 'completed' 
                                ? 'linear-gradient(135deg, #10B981 0%, #34D399 100%)'
                                : job.status === 'failed'
                                ? 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)'
                                : 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
                            }}
                          />
                        </div>
                        <div className="text-xs text-[#90CAF9] mt-1">{job.progress_pct}%</div>
                      </div>
                    </td>
                    <td className="py-4 text-[#E3F2FD]">
                      {job.rows_inserted ? (
                        <div>
                          <AnimatedNumber value={job.rows_inserted} className="font-medium" />
                          {job.rows_skipped ? (
                            <div className="text-xs text-[#90CAF9]">
                              {job.rows_skipped} skipped
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[#5C8FBF]">—</span>
                      )}
                    </td>
                    <td className="py-4 text-[#90CAF9] text-sm">
                      {new Date(job.created_at).toLocaleDateString()}
                      <div className="text-xs text-[#5C8FBF]">
                        {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          className="p-1 text-[#5C8FBF] hover:text-[#42A5F5] transition-colors"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {job.status === 'completed' && (
                          <button
                            className="p-1 text-[#5C8FBF] hover:text-red-400 transition-colors"
                            title="Undo import"
                          >
                            <Trash2 className="h-4 w-4" />
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
      </LiquidGlassCard>

      {/* Ad Slot G - Data Enhancement */}
      <LiquidGlassCard className="p-6 border-[#42A5F5]/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)',
                boxShadow: '0 4px 16px rgba(66, 165, 245, 0.3)'
              }}
            >
              <Plus className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 
                className="font-semibold bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #FFFFFF 0%, #90CAF9 100%)'
                }}
              >
                Data Enhancement Services
              </h3>
              <p className="text-[#90CAF9] text-sm">
                Let our experts clean and enrich your data for better insights
              </p>
            </div>
          </div>
          <GradientButton size="sm">
            Learn More
          </GradientButton>
        </div>
      </LiquidGlassCard>
    </div>
  );
}
