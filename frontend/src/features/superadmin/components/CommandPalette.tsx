import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { NAV_ITEMS } from "@/features/superadmin/components/SuperadminShell";
import { toast } from "@/shared/ui/toast";
import { sa } from "@/lib/api/superadmin";

type SearchResult =
  | { kind: "nav"; label: string; href: string }
  | { kind: "tenant"; id: string; label: string }
  | { kind: "user"; id: string; label: string; email?: string }
  | { kind: "action"; label: string; run: () => void | Promise<void>; impersonate?: boolean };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    const navMatches: SearchResult[] = NAV_ITEMS.filter((item) =>
      item.label.toLowerCase().includes(trimmed.toLowerCase()),
    ).map((item) => ({ kind: "nav", label: item.label, href: item.href }));

    if (trimmed.length < 2) {
      setResults(navMatches);
      return;
    }

    setLoading(true);
    try {
      const [tenants, users] = await Promise.all([
        sa.tenants({ search: trimmed, limit: 5 }),
        sa.users({ search: trimmed, limit: 5 }),
      ]);
      const tenantItems = tenants.items.map((t) => ({ id: t.id, name: t.name }));
      const tenantResults: SearchResult[] = tenantItems.map((t) => ({
        kind: "tenant",
        id: t.id,
        label: t.name,
      }));
      const userResults: SearchResult[] = users.items.map((u) => ({
        kind: "user",
        id: String(u.id),
        label: String(u.display_name || u.email || u.id),
        email: u.email as string | undefined,
      }));
      const actions: SearchResult[] = [
        {
          kind: "action",
          label: "Run founder brief now",
          run: async () => {
            await sa.runFounderBrief();
          },
        },
      ];
      for (const t of tenantItems) {
        actions.unshift({
          kind: "action",
          label: `Impersonate ${t.name}`,
          impersonate: true,
          run: async () => {
            const r = await sa.impersonate(
              t.id,
              "Command palette quick impersonation for support",
            );
            if (r.magic_link) {
              window.open(r.magic_link, "_blank", "noopener,noreferrer");
            } else {
              toast.error("Impersonation failed â€” no magic link returned");
            }
          },
        });
      }
      const billingTenantId = tenantItems[0]?.id;
      actions.push({
        kind: "action",
        label: "Open billing ops",
        run: async () => {
          navigate(
            billingTenantId
              ? `/superadmin/billing?tenant=${billingTenantId}`
              : "/superadmin/billing",
          );
        },
      });
      setResults([...navMatches, ...tenantResults, ...userResults, ...actions]);
    } catch {
      setResults(navMatches);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void search(query), 200);
    return () => clearTimeout(t);
  }, [query, open, search]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  async function select(item: SearchResult) {
    if (item.kind === "nav") {
      navigate(item.href);
      close();
      return;
    }
    if (item.kind === "tenant") {
      navigate(`/superadmin/tenants?open=${item.id}`);
      close();
      return;
    }
    if (item.kind === "user") {
      navigate(`/superadmin/users?search=${encodeURIComponent(item.email || item.label)}`);
      close();
      return;
    }
    if (item.kind === "action") {
      await item.run();
      close();
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 pt-[15vh] p-4"
      onClick={close}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-sa-border bg-sa-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          placeholder="Search tenants, users, or jump to sectionâ€¦"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full border-b border-sa-border bg-transparent px-4 py-3 text-sm text-sa-text outline-none"
        />
        <ul className="max-h-64 overflow-y-auto py-2">
          {loading && <li className="px-4 py-2 text-sm text-sa-muted">Searchingâ€¦</li>}
          {!loading &&
            results.map((item, i) => (
              <li key={`${item.kind}-${i}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-sa-text hover:bg-sa-raised"
                  onClick={() => void select(item)}
                >
                  <span className="text-[10px] uppercase text-sa-muted w-14 shrink-0">
                    {item.kind}
                  </span>
                  {item.kind === "nav" && item.label}
                  {item.kind === "tenant" && `Open ${item.label}`}
                  {item.kind === "user" && `User: ${item.label}`}
                  {item.kind === "action" && item.label}
                </button>
              </li>
            ))}
          {!loading && results.length === 0 && (
            <li className="px-4 py-3 text-sm text-sa-muted">No matches</li>
          )}
        </ul>
      </div>
    </div>
  );
}
