import { useEffect, useState } from "react";

import { fetchPublicLegal } from "@/lib/api/public";
import { useBilling } from "@/hooks/useBilling";

const DISMISS_KEY = "akara_whats_new_version";

export function WhatsNewModal() {
  const { data: usage } = useBilling();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [version, setVersion] = useState("");

  useEffect(() => {
    fetchPublicLegal("changelog")
      .then((doc) => {
        if (!doc?.version || !doc.body_markdown) return;
        const targetPlans = doc.metadata?.target_plans;
        const userPlan = usage?.plan ?? "free";
        if (targetPlans && targetPlans.length > 0 && !targetPlans.includes(userPlan)) return;
        const dismissed = localStorage.getItem(DISMISS_KEY);
        if (dismissed === doc.version) return;
        setVersion(doc.version);
        setTitle(doc.title ?? "What's New");
        setBody(doc.body_markdown);
        setOpen(true);
      })
      .catch(() => {});
  }, [usage?.plan]);

  function dismiss() {
    if (version) localStorage.setItem(DISMISS_KEY, version);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="theme-product-dark max-w-md w-full rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <div className="mt-3 text-sm text-white/80 whitespace-pre-wrap max-h-64 overflow-auto">{body}</div>
        <button
          type="button"
          onClick={dismiss}
          className="mt-4 w-full rounded-lg bg-[#03B3C3]/90 py-2 text-sm font-medium text-white hover:bg-[#03B3C3]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
