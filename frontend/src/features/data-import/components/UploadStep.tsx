import { useRef, useState } from "react";
import { Upload } from "lucide-react";

import { uploadCafeFile } from "@/features/data-import/api/cafeImportApi";
import type { CafeFlags, CafeImportType } from "@/features/data-import/api/types";
import GlowCTAButton from "@/shared/ui/GlowCTAButton";
import { toast } from "@/shared/ui/toast";
import { formatApiError } from "@/lib/formatApiError";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS: { value: CafeImportType | "auto"; label: string }[] = [
  { value: "cafe_orders", label: "Orders" },
  { value: "cafe_expenses", label: "Expenses" },
  { value: "cafe_inventory", label: "Inventory" },
  { value: "auto", label: "Auto-detect" },
];

const ALLOWED_EXT = /\.(csv|xlsx|xls)$/i;

type Props = {
  flags: CafeFlags;
  onUploaded: (importId: string, importType: string) => void;
};

export function UploadStep({ flags, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<CafeImportType | "auto">("cafe_orders");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const disabled = !flags.cafe_import;

  function pickFile(f: File | null) {
    if (!f) return;
    if (!ALLOWED_EXT.test(f.name)) {
      toast.error("Only .csv, .xlsx, or .xls files are allowed.");
      return;
    }
    if (f.size > flags.max_upload_bytes) {
      toast.error(
        `File exceeds plan limit (${Math.round(flags.max_upload_bytes / 1_000_000)} MB).`,
      );
      return;
    }
    setFile(f);
  }

  async function onSubmit() {
    if (!file || disabled) return;
    setBusy(true);
    try {
      const res = await uploadCafeFile(file, importType);
      if ("existing_import_id" in res) {
        toast.info(`Duplicate file — existing import ${res.existing_import_id}`);
        return;
      }
      onUploaded(res.import_id, res.import_type);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-white">Step 1 — Upload</h2>
        <p className="text-sm text-text-muted mt-1">
          Max upload {Math.round(flags.max_upload_bytes / 1_000_000)} MB · CSV / XLSX / XLS
        </p>
      </div>

      {disabled && (
        <p className="text-sm rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-100">
          Café import is not enabled on this workspace plan. Contact your owner or upgrade.
        </p>
      )}

      <label className="block text-sm text-text-muted">
        Import type
        <select
          className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
          value={importType}
          disabled={disabled}
          onChange={(e) => setImportType(e.target.value as CafeImportType | "auto")}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pickFile(e.dataTransfer.files?.[0] ?? null);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "rounded-2xl border border-dashed px-6 py-12 text-center cursor-pointer transition-colors",
          dragOver ? "border-accent bg-accent/10" : "border-white/20 bg-white/[0.03]",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <Upload className="h-8 w-8 mx-auto text-accent mb-3" />
        <p className="text-sm text-white">{file ? file.name : "Drop a file here or click to browse"}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          disabled={disabled}
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <GlowCTAButton
        type="button"
        disabled={!file || disabled || busy}
        onClick={() => void onSubmit()}
      >
        {busy ? "Uploading…" : "Continue to mapping"}
      </GlowCTAButton>
    </div>
  );
}
