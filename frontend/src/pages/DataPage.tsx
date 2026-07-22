import { useState, useRef } from "react";
import { Upload, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { isAdmin } from "@/lib/auth-utils";

interface ImportResult {
  rows_inserted: number;
  rows_skipped: number;
  errors: string[];
  warnings: string[];
}

type SourceType = "primary" | "secondary" | "scheme";

const BASE = import.meta.env.VITE_API_BASE_URL as string;

async function uploadFile(
  file: File,
  sourceType: SourceType,
  onProgress: (p: number) => void
): Promise<ImportResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const formData = new FormData();
  formData.append("file", file);

  // Simulate animated progress since fetch doesn't expose upload progress
  let simulatedProgress = 0;
  const progressInterval = setInterval(() => {
    simulatedProgress = Math.min(85, simulatedProgress + Math.random() * 12 + 3);
    onProgress(Math.round(simulatedProgress));
  }, 200);

  try {
    const res = await fetch(`${BASE}/data/import?source_type=${sourceType}`, {
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

interface UploadPanelProps {
  title: string;
  description: string;
  columns: string[];
  sourceType: SourceType;
  isAdmin: boolean;
  accentColor?: "slate" | "blue" | "purple";
}

function UploadPanel({
  title,
  description,
  columns,
  sourceType,
  isAdmin,
  accentColor = "slate",
}: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const borderColorClass = {
    slate: "border-slate-200",
    blue: "border-blue-200",
    purple: "border-purple-200",
  }[accentColor];

  const headerBgClass = {
    slate: "",
    blue: "bg-blue-50/40",
    purple: "bg-purple-50/40",
  }[accentColor];

  async function handleUpload() {
    if (!file || !isAdmin) return;
    setUploading(true);
    setProgress(0);
    setResult(null);
    setError(null);
    try {
      const r = await uploadFile(file, sourceType, setProgress);
      setResult(r);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
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
  }

  return (
    <Card className={`border ${borderColorClass}`}>
      <CardHeader className={headerBgClass}>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* Drop zone */}
        <div
          onClick={() => isAdmin && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isAdmin
              ? "border-slate-200 cursor-pointer hover:border-slate-400 hover:bg-slate-50"
              : "border-slate-100 cursor-not-allowed opacity-50"
          }`}
        >
          <Upload className="h-7 w-7 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">
            {file ? file.name : "Click to select file"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {file
              ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
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

        {/* Progress bar */}
        {uploading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Importing...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Action button */}
        <Button
          onClick={handleUpload}
          disabled={!file || uploading || !isAdmin}
          className="w-full"
        >
          {uploading ? "Importing..." : "Import Data"}
        </Button>

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Success state */}
        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
              <p className="text-sm text-green-700">
                <span className="font-medium">{result.rows_inserted}</span> rows imported
                {result.rows_skipped > 0 && (
                  <span className="text-green-600">
                    {" "}
                    · {result.rows_skipped} skipped
                  </span>
                )}
              </p>
            </div>
            {result.errors.length > 0 && (
              <details className="text-xs text-red-600">
                <summary className="cursor-pointer font-medium">
                  {result.errors.length} errors
                </summary>
                <ul className="mt-1 space-y-1 pl-4 list-disc">
                  {result.errors.slice(0, 20).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </details>
            )}
            {result.warnings.length > 0 && (
              <details className="text-xs text-amber-600">
                <summary className="cursor-pointer font-medium">
                  {result.warnings.length} warnings
                </summary>
                <ul className="mt-1 space-y-1 pl-4 list-disc">
                  {result.warnings.slice(0, 20).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* Expected columns (collapsible) */}
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer font-medium flex items-center gap-1 select-none">
            <FileText className="h-3 w-3" /> Expected columns
          </summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {columns.map((col) => (
              <code
                key={col}
                className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-700"
              >
                {col}
              </code>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

export function DataPage() {
  const { user, session, loading } = useAuth();
  const admin = isAdmin(user, session);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Data Management</h1>
        <p className="text-sm text-slate-500 mt-1">
          Import primary sales, secondary DMS data, and scheme master — each to
          the correct table. Supported formats: .xlsx, .xls, .csv
        </p>
      </div>

      {!admin && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <span>
            Only admins can import data. Contact your administrator to upload
            files.
          </span>
        </div>
      )}

      <UploadPanel
        title="Primary Sales (ERP / Tally)"
        description="Dispatch invoices from Tally or your ERP. What you shipped to distributors."
        sourceType="primary"
        isAdmin={admin}
        accentColor="slate"
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
        isAdmin={admin}
        accentColor="blue"
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
        isAdmin={admin}
        accentColor="purple"
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
  );
}
