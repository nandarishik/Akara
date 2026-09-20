import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Coffee, ShieldAlert } from "lucide-react";

import { getCafeFlags } from "@/features/data-import/api/cafeImportApi";
import type { CafeFlags } from "@/features/data-import/api/types";
import { IMPORT_ID_STORAGE_KEY } from "@/features/data-import/api/types";
import { UploadStep } from "@/features/data-import/components/UploadStep";
import { MappingConfirmStep } from "@/features/data-import/components/MappingConfirmStep";
import { ImportProgressStep } from "@/features/data-import/components/ImportProgressStep";
import { ReconciliationStep } from "@/features/data-import/components/ReconciliationStep";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import { cn } from "@/lib/utils";

type Step = "upload" | "mapping" | "progress" | "reconciliation";

const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "mapping", label: "Mapping" },
  { id: "progress", label: "Progress" },
  { id: "reconciliation", label: "Reconciliation" },
];

export function UploadWizardPage() {
  const [step, setStep] = useState<Step>("upload");
  const [importId, setImportId] = useState<string | null>(() =>
    sessionStorage.getItem(IMPORT_ID_STORAGE_KEY),
  );
  const [flags, setFlags] = useState<CafeFlags | null>(null);
  const [failMessage, setFailMessage] = useState<string | null>(null);

  useEffect(() => {
    void getCafeFlags()
      .then(setFlags)
      .catch(() =>
        setFlags({
          cafe_import: true,
          ai_mapping: false,
          quarantine_ui: true,
          max_upload_bytes: 50_000_000,
        }),
      );
  }, []);

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const mappingLocked = stepIndex >= STEPS.findIndex((s) => s.id === "progress");

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-text-muted mb-1">Café import</p>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Coffee className="h-6 w-6 text-accent" />
            Upload wizard
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Map columns, watch progress, then confirm reconciliation totals.
          </p>
        </div>
        <Link to="/data" className="text-sm text-accent hover:underline shrink-0">
          Back to Data
        </Link>
      </div>

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li key={s.id}>
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs border",
                i === stepIndex
                  ? "border-accent/60 bg-accent/15 text-accent"
                  : i < stepIndex
                    ? "border-white/20 text-white/70"
                    : "border-white/10 text-text-muted",
              )}
            >
              <span className="font-mono">{i + 1}</span>
              {s.label}
            </span>
          </li>
        ))}
      </ol>

      {failMessage && (
        <GlowSurfaceCard padding="md" hover={false} className="border border-red-500/30">
          <div className="flex gap-3 items-start">
            <ShieldAlert className="h-5 w-5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm text-white">{failMessage}</p>
              <Link to="/data" className="text-sm text-accent hover:underline mt-2 inline-block">
                Return to Data
              </Link>
            </div>
          </div>
        </GlowSurfaceCard>
      )}

      <GlowSurfaceCard padding="lg" hover={false}>
        {step === "upload" && flags && (
          <UploadStep
            flags={flags}
            onUploaded={(id) => {
              sessionStorage.setItem(IMPORT_ID_STORAGE_KEY, id);
              setImportId(id);
              setStep("mapping");
            }}
          />
        )}
        {step === "upload" && !flags && (
          <p className="text-sm text-text-muted">Loading workspace flags…</p>
        )}
        {step === "mapping" && importId && (
          <MappingConfirmStep
            importId={importId}
            onConfirmed={() => setStep("progress")}
          />
        )}
        {step === "progress" && importId && (
          <ImportProgressStep
            importId={importId}
            onCompleted={() => setStep("reconciliation")}
            onFailed={(message) => setFailMessage(message)}
          />
        )}
        {step === "reconciliation" && importId && (
          <ReconciliationStep importId={importId} onDone={() => undefined} />
        )}
        {mappingLocked && step === "mapping" ? null : null}
      </GlowSurfaceCard>
    </div>
  );
}
