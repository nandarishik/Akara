import { useEffect, useRef, useState } from "react";

import { getImportStatus } from "@/features/data-import/api/cafeImportApi";
import type { ImportStatus } from "@/features/data-import/api/types";

const TERMINAL = new Set([
  "completed",
  "failed",
  "mapping_timeout",
  "skipped",
  "undone",
  "deleted",
  "cancelled",
]);

type Props = {
  importId: string;
  onCompleted: () => void;
  onFailed: (message: string) => void;
};

export function useImportStatus(importId: string, enabled = true) {
  const [status, setStatus] = useState<ImportStatus | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    if (!enabled) return;
    let timer: number | undefined;

    async function tick() {
      try {
        const s = await getImportStatus(importId);
        if (stopped.current) return;
        setStatus(s);
        if (TERMINAL.has(s.status)) {
          stopped.current = true;
          return;
        }
      } catch {
        /* keep polling until terminal or unmount */
      }
      if (!stopped.current) {
        timer = window.setTimeout(() => void tick(), 2000);
      }
    }

    void tick();
    return () => {
      stopped.current = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [importId, enabled]);

  return { status, stopped: stopped.current };
}

export function ImportProgressStep({ importId, onCompleted, onFailed }: Props) {
  const { status } = useImportStatus(importId);

  useEffect(() => {
    if (!status) return;
    if (status.status === "completed") onCompleted();
    if (status.status === "failed" || status.status === "mapping_timeout") {
      onFailed(status.error_message || `Import ${status.status}`);
    }
  }, [status, onCompleted, onFailed]);

  const pct = status?.progress_pct ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-white">Step 3 — Progress</h2>
        <p className="text-sm text-text-muted mt-1">Polling every 2 seconds until the job finishes.</p>
      </div>

      <div className="h-3 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-text-muted">Status</dt>
          <dd className="text-white font-medium">{status?.status ?? "…"}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Progress</dt>
          <dd className="text-white font-medium">{pct}%</dd>
        </div>
        <div>
          <dt className="text-text-muted">Batch</dt>
          <dd className="text-white font-medium">
            {status
              ? `Batch ${status.last_completed_batch} of ${status.total_batches}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-text-muted">Quarantine rows</dt>
          <dd className="text-white font-medium">{status?.quarantine_row_count ?? 0}</dd>
        </div>
      </dl>
    </div>
  );
}
