import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

import type { CopilotStatus } from "../hooks/useCopilotStatus";

type Props = {
  status: CopilotStatus | null | undefined;
};

export function AIOutageBanner({ status }: Props) {
  if (!status || status.llm_available) return null;

  const message =
    status.reason ||
    "The AI assistant is temporarily unavailable. Your dashboard and reports still work normally.";

  return (
    <div
      role="status"
      className="mx-4 mb-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        <p>{message}</p>
        <p>
          <Link to="/dashboard" className="font-medium underline underline-offset-2">
            Open dashboard
          </Link>
          {status.retry_after_seconds != null ? (
            <span className="ml-2 text-xs opacity-80">
              Retry in ~{status.retry_after_seconds}s
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
