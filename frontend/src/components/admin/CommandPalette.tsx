import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { NAV_ITEMS } from "@/components/admin/SuperadminShell";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
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

  if (!open) return null;

  const q = query.toLowerCase();
  const matches = NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(q));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 pt-[15vh] p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-sa-border bg-sa-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          placeholder="Jump to section…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full border-b border-sa-border bg-transparent px-4 py-3 text-sm text-sa-text outline-none"
        />
        <ul className="max-h-64 overflow-y-auto py-2">
          {matches.map((item) => (
            <li key={item.href}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-sa-text hover:bg-sa-raised"
                onClick={() => {
                  navigate(item.href);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-4 py-3 text-sm text-sa-muted">No matches</li>
          )}
        </ul>
      </div>
    </div>
  );
}
