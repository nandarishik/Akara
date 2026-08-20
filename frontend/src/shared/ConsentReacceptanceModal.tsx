import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import GlowCTAButton from "@/shared/ui/GlowCTAButton";
import { supabase } from "@/lib/supabase";

const BASE = import.meta.env.VITE_API_BASE_URL as string;

type ConsentStatus = {
  terms_version: string;
  privacy_version: string;
  accepted_terms: string | null;
  accepted_privacy: string | null;
  ai_processing: boolean;
  reaccept_required: boolean;
};

export function ConsentReacceptanceModal() {
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      try {
        const res = await fetch(`${BASE}/auth/consent-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const body = (await res.json()) as ConsentStatus;
        setStatus(body);
      } catch {
        // non-blocking â€” modal only when API confirms reaccept
      }
    }
    void load();
  }, []);

  if (!status?.reaccept_required) return null;

  async function accept() {
    if (!terms || !privacy || !aiConsent) {
      setError("Please accept all items to continue.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/auth/consent-accept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ terms: true, privacy: true, ai_processing: true }),
      });
      if (!res.ok) {
        setError("Could not save consent. Try again.");
        return;
      }
      setStatus({ ...status!, reaccept_required: false });
    } catch {
      setError("Could not save consent. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl">
        <h2 id="consent-modal-title" className="text-lg font-semibold text-white mb-2">
          Updated terms & privacy
        </h2>
        <p className="text-sm text-white/60 mb-4">
          Our Terms of Service (v{status.terms_version}) and Privacy Policy (v{status.privacy_version}) have been
          updated. Please review and accept to continue using AKARA.
        </p>
        <div className="space-y-3 text-sm text-white/80 mb-4">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I accept the{" "}
              <Link to="/terms" className="text-[#03B3C3] hover:underline" target="_blank">
                Terms of Service
              </Link>{" "}
              (v{status.terms_version})
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={privacy}
              onChange={(e) => setPrivacy(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I accept the{" "}
              <Link to="/privacy" className="text-[#03B3C3] hover:underline" target="_blank">
                Privacy Policy
              </Link>{" "}
              (v{status.privacy_version})
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={aiConsent}
              onChange={(e) => setAiConsent(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I consent to my sales data being processed by AI to generate analytics (DPDP Act
              2023)
            </span>
          </label>
        </div>
        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
        <GlowCTAButton
          type="button"
          className="w-full"
          loading={submitting}
          onClick={() => void accept()}
        >
          Accept and continue
        </GlowCTAButton>
      </div>
    </div>
  );
}
