import { useRef, useState } from "react";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  FileText,
  Loader2,
  PlayCircle,
  Activity,
  Database,
} from "lucide-react";


import { AkaraButton } from "@/components/ui/GradientButton";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { cn } from "@/lib/utils";

export type SourceType = "primary" | "secondary" | "scheme";

export interface ImportResult {
  rows_inserted: number;
  rows_skipped: number;
  errors: string[];
  warnings: string[];
}

interface DataUploadPanelProps {
  title: string;
  subtitle: string;
  columns: string[];
  sourceType: SourceType;
  isAdmin: boolean;
  uploadDisabled?: boolean;
  onUpload: (
    file: File,
    sourceType: SourceType,
    useAsync: boolean,
    onProgress: (p: number) => void
  ) => Promise<ImportResult | { job_id: string }>;
  onComplete?: () => void;
}

export function DataUploadPanel({
  title,
  subtitle,
  columns,
  sourceType,
  isAdmin,
  uploadDisabled = false,
  onUpload,
  onComplete,
}: DataUploadPanelProps) {
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
      const r = await onUpload(file, sourceType, useAsync || file.size > 5 * 1024 * 1024, setProgress);
      setResult(r);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onComplete?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
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
    if (selected && selected.size > 5 * 1024 * 1024) setUseAsync(true);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
        <p className="text-sm text-text-secondary mt-1 max-w-2xl leading-relaxed">{subtitle}</p>
      </div>

      <div
        role="button"
        tabIndex={isAdmin ? 0 : -1}
        onClick={() => isAdmin && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && isAdmin && inputRef.current?.click()}
        className={cn(
          "relative rounded-2xl border-2 border-dashed transition-all duration-200 px-6 py-10 text-center",
          isAdmin ? "cursor-pointer" : "cursor-not-allowed opacity-60",
          file
            ? "border-accent/50 bg-accent-soft/40"
            : "border-surface-border bg-surface-card hover:border-accent/40 hover:bg-accent-soft/20"
        )}
      >
        <div
          className={cn(
            "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-colors",
            file ? "bg-accent text-white shadow-md" : "bg-surface-raised text-accent"
          )}
        >
          <Upload className="h-6 w-6" />
        </div>
        <p className="font-medium text-text-primary">
          {file ? file.name : "Drop your file here, or click to browse"}
        </p>
        <p className="mt-1.5 text-xs text-text-muted">
          {file
            ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
            : ".xlsx, .xls, .csv · up to 50 MB"}
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

      {file && file.size <= 5 * 1024 * 1024 && (
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={useAsync}
            onChange={(e) => setUseAsync(e.target.checked)}
            className="rounded border-surface-border text-accent focus:ring-accent"
          />
          <Activity className="h-4 w-4 text-accent" />
          Process in background
        </label>
      )}

      {uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-text-secondary">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-raised overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {uploadDisabled && (
        <p className="text-xs text-amber-700 text-center">
          Daily upload limit reached — resets at midnight IST
        </p>
      )}

      <AkaraButton
        type="button"
        onClick={() => void handleUpload()}
        disabled={!file || uploading || !isAdmin || uploadDisabled}
        className="w-full sm:w-auto sm:min-w-[200px]"
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {useAsync ? "Queueing…" : "Importing…"}
          </>
        ) : (
          <>
            <Database className="h-4 w-4" />
            Import data
          </>
        )}
      </AkaraButton>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Import failed</p>
            <p className="text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm">
          {"job_id" in result ? (
            <div className="flex items-center gap-2 text-emerald-800">
              <PlayCircle className="h-5 w-5 shrink-0" />
              <span>
                Queued — job <code className="text-xs bg-white/60 px-1 rounded">{result.job_id.slice(0, 8)}…</code>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <span>
                <AnimatedNumber value={result.rows_inserted} /> rows imported
                {result.rows_skipped > 0 && ` · ${result.rows_skipped} skipped`}
              </span>
            </div>
          )}
        </div>
      )}

      <details className="group">
        <summary className="cursor-pointer text-sm text-text-muted hover:text-accent flex items-center gap-2 select-none">
          <FileText className="h-4 w-4" />
          Expected columns ({columns.length})
        </summary>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {columns.map((col) => (
            <code
              key={col}
              className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-surface-raised text-text-secondary"
            >
              {col}
            </code>
          ))}
        </div>
      </details>
    </div>
  );
}
