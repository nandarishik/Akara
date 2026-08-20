import { useEffect, useState } from "react";
import { Loader2, Scale, Sparkles } from "lucide-react";

import { superadminFetch } from "@/lib/api/superadmin";

interface DocumentVersion {
  id: string;
  document_key: string;
  version: string;
  title: string;
  effective_at: string;
  requires_reacceptance: boolean;
  is_published: boolean;
}

interface AcceptanceRate {
  accepted: number;
  total_users: number;
  rate_pct: number;
}

export function LegalPage() {
  const [docs, setDocs] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [acceptanceRates, setAcceptanceRates] = useState<Record<string, AcceptanceRate>>({});
  const [form, setForm] = useState({
    document_key: "terms",
    version: "",
    title: "",
    body_markdown: "",
    requires_reacceptance: false,
    effective_at: "",
    target_plans: "",
  });
  const [editorTab, setEditorTab] = useState<"legal" | "changelog">("legal");

  async function load() {
    setLoading(true);
    try {
      const data = await superadminFetch<{ items: DocumentVersion[] }>("/superadmin/legal/documents");
      const items = data.items ?? [];
      setDocs(items);
      const rates: Record<string, AcceptanceRate> = {};
      await Promise.all(
        items.slice(0, 8).map(async (d) => {
          try {
            const rate = await superadminFetch<AcceptanceRate>(
              `/superadmin/legal/documents/${d.document_key}/acceptance-rate?version=${encodeURIComponent(d.version)}`,
            );
            rates[`${d.document_key}:${d.version}`] = rate;
          } catch {
            // non-blocking
          }
        }),
      );
      setAcceptanceRates(rates);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function publishDocument(dryRun: boolean) {
    const effectiveAt = form.effective_at
      ? new Date(form.effective_at).toISOString()
      : new Date().toISOString();
    const metadata =
      form.document_key === "changelog" && form.target_plans.trim()
        ? { target_plans: form.target_plans.split(",").map((p) => p.trim()).filter(Boolean) }
        : {};
    try {
      await superadminFetch("/superadmin/legal/documents/publish", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          effective_at: effectiveAt,
          metadata,
          reason: `Publish ${form.document_key} version ${form.version} from Legal & Changelog`,
          dry_run: dryRun,
        }),
      });
      if (dryRun) {
        setMessage("Dry run OK — no document written.");
      } else {
        setMessage(`Published ${form.document_key} v${form.version}`);
        await load();
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Publish failed");
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold sa-text">Legal & Changelog</h1>
        <p className="text-sm sa-text-muted mt-1">Immutable legal versions and release notes</p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 sa-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading documents…
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="sa-border sa-raised rounded-xl p-4 space-y-3">
          <h2 className="sa-text font-medium flex items-center gap-2">
            <Scale className="h-4 w-4" /> Published archive
          </h2>
          <div className="space-y-2 max-h-64 overflow-auto">
            {docs.map((d) => {
              const rate = acceptanceRates[`${d.document_key}:${d.version}`];
              return (
                <div key={d.id} className="sa-border rounded-lg p-2 text-sm">
                  <p className="sa-text font-medium">{d.title}</p>
                  <p className="sa-text-muted text-xs">
                    {d.document_key} v{d.version}
                    {d.requires_reacceptance && " · reacceptance required"}
                  </p>
                  {rate && (
                    <p className="text-xs text-emerald-400 mt-1">
                      Acceptance: {rate.rate_pct.toFixed(1)}% ({rate.accepted}/{rate.total_users})
                    </p>
                  )}
                </div>
              );
            })}
            {docs.length === 0 && !loading && <p className="sa-text-muted text-sm">No documents yet.</p>}
          </div>
        </div>

        <div className="sa-border sa-raised rounded-xl p-4 space-y-3">
          <div className="flex gap-2 border-b sa-border pb-2">
            <button
              type="button"
              onClick={() => {
                setEditorTab("legal");
                setForm((f) => ({ ...f, document_key: "terms" }));
              }}
              className={`px-3 py-1 text-sm rounded-lg ${editorTab === "legal" ? "sa-text font-medium" : "sa-text-muted"}`}
            >
              Legal
            </button>
            <button
              type="button"
              onClick={() => {
                setEditorTab("changelog");
                setForm((f) => ({ ...f, document_key: "changelog" }));
              }}
              className={`px-3 py-1 text-sm rounded-lg ${editorTab === "changelog" ? "sa-text font-medium" : "sa-text-muted"}`}
            >
              Changelog
            </button>
          </div>
          <h2 className="sa-text font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> New version
          </h2>
          {editorTab === "legal" ? (
          <select
            value={form.document_key}
            onChange={(e) => setForm((f) => ({ ...f, document_key: e.target.value }))}
            className="w-full sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent"
          >
            <option value="terms">Terms of Service</option>
            <option value="privacy">Privacy Policy</option>
            <option value="dpdp">DPDP Notice</option>
          </select>
          ) : (
            <p className="text-xs sa-text-muted">Publishing to changelog / What&apos;s New</p>
          )}
          <input
            placeholder="Version (e.g. 1.1)"
            value={form.version}
            onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
            className="w-full sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent"
          />
          <input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent"
          />
          <input
            type="datetime-local"
            value={form.effective_at}
            onChange={(e) => setForm((f) => ({ ...f, effective_at: e.target.value }))}
            className="w-full sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent"
          />
          <textarea
            placeholder="Body (markdown)"
            rows={6}
            value={form.body_markdown}
            onChange={(e) => setForm((f) => ({ ...f, body_markdown: e.target.value }))}
            className="w-full sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent font-mono"
          />
          {editorTab === "changelog" && (
            <input
              placeholder="Target plans (comma-separated, e.g. pro,business — empty = all)"
              value={form.target_plans}
              onChange={(e) => setForm((f) => ({ ...f, target_plans: e.target.value }))}
              className="w-full sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent"
            />
          )}
          <label className="flex items-center gap-2 text-sm sa-text">
            <input
              type="checkbox"
              checked={form.requires_reacceptance}
              onChange={(e) => setForm((f) => ({ ...f, requires_reacceptance: e.target.checked }))}
            />
            Requires re-acceptance
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => void publishDocument(true)} className="sa-border sa-raised px-3 py-1.5 text-sm sa-text rounded-lg">
              Preview
            </button>
            <button type="button" onClick={() => void publishDocument(false)} className="bg-emerald-600/80 px-3 py-1.5 text-sm text-white rounded-lg">
              Publish
            </button>
          </div>
          {editorTab === "changelog" && form.body_markdown && (
            <div className="sa-border rounded-lg p-3 text-sm sa-text-muted whitespace-pre-wrap max-h-40 overflow-auto">
              <p className="text-xs sa-text mb-2">Changelog preview</p>
              {form.body_markdown}
            </div>
          )}
        </div>
      </div>

      {message && <p className="text-sm sa-text-muted">{message}</p>}
    </div>
  );
}
