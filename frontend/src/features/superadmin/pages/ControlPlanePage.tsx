import { useEffect, useMemo, useState } from "react";
import { Database, Play, ShieldCheck, Terminal, Workflow } from "lucide-react";
import { sa } from "@/lib/api/superadmin";

type Tab = "studio" | "query" | "runbooks" | "ai" | "templates";

export function ControlPlanePage({ defaultTab = "studio" }: { defaultTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [tables, setTables] = useState<Record<string, any>[]>([]);
  const [runbooks, setRunbooks] = useState<Record<string, any>[]>([]);
  const [templates, setTemplates] = useState<Record<string, any>[]>([]);
  const [sql, setSql] = useState("SELECT id, name, plan, plan_status FROM tenants ORDER BY created_at DESC");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void Promise.all([sa.dataStudioTables(), sa.runbooks(), sa.templates()]).then(([tableData, runbookData, templateData]) => {
      setTables((tableData as any).items ?? tableData as any);
      setRunbooks(runbookData.items ?? []);
      setTemplates(templateData.items ?? []);
    }).catch(() => undefined);
  }, []);

  const tabs = useMemo(() => [
    ["studio", "Data Studio", Database],
    ["query", "Query Console", Terminal],
    ["runbooks", "Runbooks", Workflow],
    ["ai", "AI Control Room", ShieldCheck],
    ["templates", "Templates", Play],
  ] as const, []);

  async function executeQuery() {
    if (!reason.trim() || !sql.trim()) return;
    setLoading(true);
    try { setResult(await sa.executeQuery({ sql, reason })); } catch (error) { setResult({ error: String(error) }); } finally { setLoading(false); }
  }

  async function dryRun(name: string, parameters: Record<string, unknown>) {
    if (!reason.trim()) return;
    setLoading(true);
    try { setResult(await sa.runbookDryRun(name, { parameters, reason })); } catch (error) { setResult({ error: String(error) }); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4 text-sa-text">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Control Plane</h2><p className="text-xs text-sa-muted">Allowlisted data, read-only SQL, typed operations, AI policy, and published communications.</p></div>
        <input aria-label="Mutation reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for an operation (required)" className="w-full max-w-sm rounded border border-sa-border bg-sa-surface px-3 py-2 text-xs" />
      </div>
      <div className="flex flex-wrap gap-2 border-b border-sa-border pb-2">
        {tabs.map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setTab(key)} className={`flex items-center gap-2 rounded px-3 py-2 text-xs ${tab === key ? "bg-sa-accent/20 text-sa-text" : "text-sa-muted hover:bg-sa-raised"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
      </div>
      {tab === "studio" && <section className="grid gap-3 md:grid-cols-2">{tables.map((table) => <button key={table.table} type="button" onClick={() => setResult(table)} className="rounded border border-sa-border bg-sa-raised p-4 text-left hover:border-sa-accent"><p className="font-mono text-sm text-[#22D3EE]">{table.table}</p><p className="mt-1 text-xs text-sa-muted">{table.description}</p><p className="mt-2 text-[10px] text-sa-muted">{(table.columns as string[] | undefined)?.length ?? 0} columns · masked PII enforced server-side</p></button>)}</section>}
      {tab === "query" && <section className="space-y-3"><textarea aria-label="Read-only SQL" value={sql} onChange={(event) => setSql(event.target.value)} className="min-h-48 w-full rounded border border-sa-border bg-sa-surface p-3 font-mono text-xs text-[#D7F9FF]" /><div className="flex items-center justify-between"><p className="text-xs text-sa-muted">One SELECT statement · 10s timeout · 10,000-row cap · protected schemas blocked.</p><button type="button" disabled={loading || reason.trim().length < 10} onClick={() => void executeQuery()} className="rounded bg-sa-accent px-4 py-2 text-xs text-white disabled:opacity-50">{loading ? "Running..." : "Run read-only query"}</button></div></section>}
      {tab === "runbooks" && <section className="space-y-2">{runbooks.map((runbook) => <div key={runbook.name} className="flex flex-wrap items-center justify-between gap-3 rounded border border-sa-border bg-sa-raised p-3"><div><p className="font-mono text-sm text-[#22D3EE]">{runbook.name}</p><p className="text-xs text-sa-muted">{runbook.purpose}</p><p className="text-[10px] text-sa-muted">Max {runbook.max_rows} rows · {runbook.reversible ? "reversible" : "not reversible"}</p></div><button type="button" disabled={loading || reason.trim().length < 10} onClick={() => void dryRun(runbook.name, {})} className="rounded border border-sa-border px-3 py-2 text-xs hover:border-sa-accent disabled:opacity-50">Dry run</button></div>)}</section>}
      {tab === "ai" && <section className="rounded border border-sa-border bg-sa-raised p-4"><h3 className="font-medium">AI request and policy controls</h3><p className="mt-1 text-xs text-sa-muted">Published prompt versions, deterministic rollout, budgets, circuit breakers, and replay-as-test traffic are managed through the protected API.</p></section>}
      {tab === "templates" && <section className="grid gap-3 md:grid-cols-2">{templates.map((template) => <div key={template.key} className="rounded border border-sa-border bg-sa-raised p-4"><div className="flex items-center justify-between"><p className="font-mono text-sm text-[#22D3EE]">{template.key}</p><span className="text-[10px] uppercase text-sa-muted">{template.channel}</span></div><p className="mt-2 text-xs text-sa-muted">{template.status === "fallback" ? "Checked-in fallback" : "Database controlled"}</p><p className="mt-1 text-[10px] text-sa-muted">Variables: {(template.allowed_variables as string[] | undefined)?.join(", ") || "none"}</p></div>)}</section>}
      {result !== null && <pre className="max-h-72 overflow-auto rounded border border-sa-border bg-sa-surface p-3 text-[10px] text-[#D7F9FF]">{String(JSON.stringify(result, null, 2))}</pre>}
    </div>
  );
}
