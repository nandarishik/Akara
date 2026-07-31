import { useEffect, useState } from "react";
import { BarChart3, FileText, Image, Layout, Loader2 } from "lucide-react";

import { superadminFetch } from "@/lib/api/superadmin";
import { ALL_PLACEMENT_KEY_VALUES, PLACEMENT_KEYS } from "@/lib/promoSlots";

type Tab = "content" | "placements" | "media";

interface ContentEntry {
  key: string;
  locale: string;
  draft_value: Record<string, unknown>;
  published_value?: Record<string, unknown> | null;
  scheduled_at?: string | null;
  version: number;
}

interface PlacementSlot {
  key: string;
  kind: string;
  draft_content: Record<string, unknown>;
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  audience_rules?: Record<string, unknown> | null;
}

interface MediaAsset {
  id: string;
  public_url: string;
  kind: string;
  alt_text: string;
}

interface PlacementStat {
  slot_key: string;
  impressions: number;
  clicks: number;
}

export function ContentPage() {
  const [tab, setTab] = useState<Tab>("content");
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [placements, setPlacements] = useState<PlacementSlot[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [stats, setStats] = useState<PlacementStat[]>([]);
  const [message, setMessage] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<ContentEntry | null>(null);
  const [entryJson, setEntryJson] = useState("{}");
  const [scheduleAt, setScheduleAt] = useState("");
  const [selectedPlacement, setSelectedPlacement] = useState<string>(PLACEMENT_KEYS.A);
  const [placementJson, setPlacementJson] = useState("{}");
  const [placementKind, setPlacementKind] = useState("promotion");
  const [placementStartsAt, setPlacementStartsAt] = useState("");
  const [placementEndsAt, setPlacementEndsAt] = useState("");
  const [placementAudienceJson, setPlacementAudienceJson] = useState("{}");
  const [structuredFaqsJson, setStructuredFaqsJson] = useState("");
  const [structuredSeoTitle, setStructuredSeoTitle] = useState("");
  const [structuredSeoDescription, setStructuredSeoDescription] = useState("");
  const [uploadAlt, setUploadAlt] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const [c, p, m, s] = await Promise.all([
        superadminFetch<{ items: ContentEntry[] }>("/superadmin/content/entries"),
        superadminFetch<{ items: PlacementSlot[] }>("/superadmin/content/placements"),
        superadminFetch<{ items: MediaAsset[] }>("/superadmin/content/media"),
        superadminFetch<{ items: PlacementStat[] }>("/superadmin/content/placements/stats"),
      ]);
      setEntries(c.items ?? []);
      setPlacements(p.items ?? []);
      setMedia(m.items ?? []);
      setStats(s.items ?? []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (placements.length > 0) loadPlacementEditor(selectedPlacement);
  }, [placements.length]);

  function selectEntry(e: ContentEntry) {
    setSelectedEntry(e);
    setEntryJson(JSON.stringify(e.draft_value ?? {}, null, 2));
    setScheduleAt(e.scheduled_at ? e.scheduled_at.slice(0, 16) : "");
    if (e.key === "landing.faqs") {
      const items = (e.draft_value as { items?: unknown[] })?.items ?? [];
      setStructuredFaqsJson(JSON.stringify(items, null, 2));
    }
    if (e.key === "landing.seo.title") {
      setStructuredSeoTitle(String((e.draft_value as { text?: string })?.text ?? ""));
    }
    if (e.key === "landing.seo.description") {
      setStructuredSeoDescription(String((e.draft_value as { text?: string })?.text ?? ""));
    }
  }

  function syncStructuredEntryJson(key: string) {
    if (key === "landing.faqs") {
      try {
        const items = JSON.parse(structuredFaqsJson) as unknown[];
        setEntryJson(JSON.stringify({ items }, null, 2));
      } catch {
        // keep raw JSON
      }
    } else if (key === "landing.seo.title") {
      setEntryJson(JSON.stringify({ text: structuredSeoTitle }, null, 2));
    } else if (key === "landing.seo.description") {
      setEntryJson(JSON.stringify({ text: structuredSeoDescription }, null, 2));
    }
  }

  async function saveEntryDraft() {
    if (!selectedEntry) return;
    try {
      const value = JSON.parse(entryJson) as Record<string, unknown>;
      await superadminFetch(`/superadmin/content/entries/${encodeURIComponent(selectedEntry.key)}`, {
        method: "PUT",
        body: JSON.stringify({ value, locale: selectedEntry.locale }),
      });
      setMessage(`Saved draft for ${selectedEntry.key}`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function previewEntry() {
    if (!selectedEntry) return;
    try {
      const data = await superadminFetch<{ value: unknown; warnings?: string[] }>(
        `/superadmin/content/entries/${encodeURIComponent(selectedEntry.key)}/preview`,
      );
      setMessage(`Preview OK${data.warnings?.length ? ` — warnings: ${data.warnings.join(", ")}` : ""}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Preview failed");
    }
  }

  async function scheduleEntry() {
    if (!selectedEntry || !scheduleAt) return;
    try {
      await superadminFetch(`/superadmin/content/entries/${encodeURIComponent(selectedEntry.key)}/schedule`, {
        method: "POST",
        body: JSON.stringify({ scheduled_at: new Date(scheduleAt).toISOString(), locale: selectedEntry.locale }),
      });
      setMessage(`Scheduled ${selectedEntry.key}`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Schedule failed");
    }
  }

  async function rollbackEntry() {
    if (!selectedEntry) return;
    try {
      await superadminFetch(`/superadmin/content/entries/${encodeURIComponent(selectedEntry.key)}/rollback`, {
        method: "POST",
      });
      setMessage(`Rolled back draft for ${selectedEntry.key}`);
      await load();
      const updated = entries.find((e) => e.key === selectedEntry.key);
      if (updated) selectEntry(updated);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Rollback failed");
    }
  }

  async function deleteMedia(id: string) {
    if (!window.confirm("Delete this media asset?")) return;
    try {
      await superadminFetch(`/superadmin/content/media/${id}`, { method: "DELETE" });
      setMessage("Media deleted");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Delete failed");
    }
  }

  function loadPlacementEditor(key: string) {
    const p = placements.find((x) => x.key === key);
    setPlacementJson(JSON.stringify(p?.draft_content ?? { title: "", body: "", cta_label: "", cta_link: "" }, null, 2));
    setPlacementKind(p?.kind ?? "promotion");
    setPlacementStartsAt(p?.starts_at ? p.starts_at.slice(0, 16) : "");
    setPlacementEndsAt(p?.ends_at ? p.ends_at.slice(0, 16) : "");
    setPlacementAudienceJson(JSON.stringify(p?.audience_rules ?? { plans: [], pages: [], frequency_cap: 0 }, null, 2));
  }

  async function publishEntry(key: string) {
    try {
      await superadminFetch(`/superadmin/content/entries/${encodeURIComponent(key)}/publish`, {
        method: "POST",
        body: JSON.stringify({ reason: "Publish landing CMS content from Content & Media" }),
      });
      setMessage(`Published ${key}`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Publish failed");
    }
  }

  async function savePlacement() {
    try {
      const content = JSON.parse(placementJson) as Record<string, unknown>;
      const audience_rules = JSON.parse(placementAudienceJson) as Record<string, unknown>;
      await superadminFetch(`/superadmin/content/placements/${encodeURIComponent(selectedPlacement)}`, {
        method: "PUT",
        body: JSON.stringify({
          content,
          kind: placementKind,
          starts_at: placementStartsAt ? new Date(placementStartsAt).toISOString() : null,
          ends_at: placementEndsAt ? new Date(placementEndsAt).toISOString() : null,
          audience_rules,
        }),
      });
      setMessage(`Saved placement ${selectedPlacement}`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Placement save failed");
    }
  }

  async function publishPlacement(key: string) {
    try {
      await superadminFetch(`/superadmin/content/placements/${encodeURIComponent(key)}/publish`, {
        method: "POST",
        body: JSON.stringify({ reason: "Publish placement slot from Content & Media" }),
      });
      setMessage(`Published placement ${key}`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Publish failed");
    }
  }

  async function uploadMedia() {
    if (!uploadFile || !uploadAlt.trim()) return;
    try {
      const token = await (async () => {
        const { supabase } = await import("@/lib/supabase");
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? "";
      })();
      const csrfMatch = document.cookie.match(/(?:^|;\s*)akara_csrf=([^;]+)/);
      const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : "";
      const form = new FormData();
      form.append("file", uploadFile);
      form.append("alt_text", uploadAlt);
      form.append("kind", "image");
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/superadmin/content/media/upload`, {
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      setMessage("Media uploaded");
      setUploadFile(null);
      setUploadAlt("");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof FileText }[] = [
    { id: "content", label: "Landing CMS", icon: FileText },
    { id: "placements", label: "Placements", icon: Layout },
    { id: "media", label: "Media", icon: Image },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold sa-text">Content & Media</h1>
        <p className="text-sm sa-text-muted mt-1">Edit public copy, placements, and media without deploy</p>
      </div>

      {stats.length > 0 && (
        <div className="sa-border sa-raised rounded-xl p-4 flex flex-wrap gap-4 items-center">
          <BarChart3 className="h-4 w-4 sa-text-muted" />
          {stats.map((s) => (
            <span key={s.slot_key} className="text-xs sa-text-muted">
              <span className="sa-text font-medium">{s.slot_key}</span>: {s.impressions} imp · {s.clicks} clicks
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-b sa-border pb-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${tab === id ? "sa-raised sa-text" : "sa-text-muted"}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 sa-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}
      {message && <p className="text-sm sa-text-muted">{message}</p>}

      {tab === "content" && !loading && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="sa-border sa-raised rounded-xl divide-y sa-border">
            {entries.length === 0 ? (
              <p className="p-4 sa-text-muted text-sm">No content entries yet. Seed via migration 025.</p>
            ) : (
              entries.map((e) => (
                <button
                  key={`${e.key}-${e.locale}`}
                  type="button"
                  className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-white/5"
                  onClick={() => selectEntry(e)}
                >
                  <div>
                    <p className="sa-text font-medium">{e.key}</p>
                    <p className="text-xs sa-text-muted">v{e.version} · {e.locale}</p>
                  </div>
                  <span className="text-xs sa-text-muted">{e.scheduled_at ? "Scheduled" : "Draft"}</span>
                </button>
              ))
            )}
          </div>
          {selectedEntry && (
            <div className="sa-border sa-raised rounded-xl p-4 space-y-3">
              <p className="sa-text font-medium">{selectedEntry.key}</p>
              {selectedEntry.key === "landing.faqs" && (
                <div className="space-y-2">
                  <p className="text-xs sa-text-muted">FAQ items (JSON array of {"{ q, a }"})</p>
                  <textarea
                    rows={6}
                    value={structuredFaqsJson}
                    onChange={(ev) => setStructuredFaqsJson(ev.target.value)}
                    onBlur={() => syncStructuredEntryJson(selectedEntry.key)}
                    className="w-full sa-border rounded-lg px-3 py-2 text-xs font-mono sa-text bg-transparent"
                  />
                </div>
              )}
              {selectedEntry.key === "landing.seo.title" && (
                <input
                  value={structuredSeoTitle}
                  onChange={(ev) => {
                    setStructuredSeoTitle(ev.target.value);
                    setEntryJson(JSON.stringify({ text: ev.target.value }, null, 2));
                  }}
                  placeholder="SEO title"
                  className="w-full sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent"
                />
              )}
              {selectedEntry.key === "landing.seo.description" && (
                <textarea
                  rows={3}
                  value={structuredSeoDescription}
                  onChange={(ev) => {
                    setStructuredSeoDescription(ev.target.value);
                    setEntryJson(JSON.stringify({ text: ev.target.value }, null, 2));
                  }}
                  placeholder="SEO description"
                  className="w-full sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent"
                />
              )}
              <textarea
                rows={10}
                value={entryJson}
                onChange={(ev) => setEntryJson(ev.target.value)}
                className="w-full sa-border rounded-lg px-3 py-2 text-xs font-mono sa-text bg-transparent"
              />
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(ev) => setScheduleAt(ev.target.value)}
                className="w-full sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent"
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void saveEntryDraft()} className="sa-border sa-raised px-3 py-1 text-sm sa-text rounded-lg">Save draft</button>
                <button type="button" onClick={() => void previewEntry()} className="sa-border sa-raised px-3 py-1 text-sm sa-text rounded-lg">Preview</button>
                <button type="button" onClick={() => void scheduleEntry()} className="sa-border sa-raised px-3 py-1 text-sm sa-text rounded-lg">Schedule</button>
                <button type="button" onClick={() => void rollbackEntry()} className="sa-border sa-raised px-3 py-1 text-sm sa-text rounded-lg">Rollback draft</button>
                <button type="button" onClick={() => void publishEntry(selectedEntry.key)} className="bg-emerald-600/80 px-3 py-1 text-sm text-white rounded-lg">Publish</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "placements" && !loading && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="sa-border sa-raised rounded-xl p-4 space-y-3">
            <label className="text-sm sa-text">Slot key</label>
            <select
              value={selectedPlacement}
              onChange={(e) => {
                setSelectedPlacement(e.target.value);
                loadPlacementEditor(e.target.value);
              }}
              className="w-full sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent"
            >
              {ALL_PLACEMENT_KEY_VALUES.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
              {placements.filter((p) => !ALL_PLACEMENT_KEY_VALUES.includes(p.key as typeof PLACEMENT_KEYS.A)).map((p) => (
                <option key={p.key} value={p.key}>{p.key}</option>
              ))}
            </select>
            <select
              value={placementKind}
              onChange={(e) => setPlacementKind(e.target.value)}
              className="w-full sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent"
            >
              <option value="promotion">promotion</option>
              <option value="demo">demo</option>
              <option value="partner">partner</option>
              <option value="announcement">announcement</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="datetime-local"
                value={placementStartsAt}
                onChange={(e) => setPlacementStartsAt(e.target.value)}
                className="sa-border rounded-lg px-3 py-2 text-xs sa-text bg-transparent"
                placeholder="Starts at"
              />
              <input
                type="datetime-local"
                value={placementEndsAt}
                onChange={(e) => setPlacementEndsAt(e.target.value)}
                className="sa-border rounded-lg px-3 py-2 text-xs sa-text bg-transparent"
                placeholder="Ends at"
              />
            </div>
            <textarea
              rows={3}
              value={placementAudienceJson}
              onChange={(e) => setPlacementAudienceJson(e.target.value)}
              placeholder='Audience rules JSON e.g. {"plans":["pro"],"pages":["/dashboard"],"frequency_cap":3}'
              className="w-full sa-border rounded-lg px-3 py-2 text-xs font-mono sa-text bg-transparent"
            />
            <textarea
              rows={8}
              value={placementJson}
              onChange={(e) => setPlacementJson(e.target.value)}
              className="w-full sa-border rounded-lg px-3 py-2 text-xs font-mono sa-text bg-transparent"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => void savePlacement()} className="sa-border sa-raised px-3 py-1 text-sm sa-text rounded-lg">Save draft</button>
              <button type="button" onClick={() => void publishPlacement(selectedPlacement)} className="bg-emerald-600/80 px-3 py-1 text-sm text-white rounded-lg">Publish</button>
            </div>
          </div>
          <div className="sa-border sa-raised rounded-xl divide-y sa-border">
            {placements.map((p) => (
              <div key={p.key} className="p-4 text-sm sa-text-muted">
                {p.key} · {p.kind} · {p.is_active ? "active" : "inactive"}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "media" && !loading && (
        <div className="space-y-4">
          <div className="sa-border sa-raised rounded-xl p-4 grid gap-3 md:grid-cols-3">
            <input type="file" accept="image/*" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} className="text-sm sa-text" />
            <input placeholder="Alt text (required)" value={uploadAlt} onChange={(e) => setUploadAlt(e.target.value)} className="sa-border rounded-lg px-3 py-2 text-sm sa-text bg-transparent" />
            <button type="button" onClick={() => void uploadMedia()} className="bg-emerald-600/80 px-3 py-2 text-sm text-white rounded-lg">Upload</button>
          </div>
          <div className="sa-border sa-raised rounded-xl divide-y sa-border">
            {media.length === 0 ? (
              <p className="p-4 sa-text-muted text-sm">No media uploaded yet.</p>
            ) : (
              media.map((m) => (
                <div key={m.id} className="p-4 flex gap-4 items-center">
                  <img src={m.public_url} alt={m.alt_text} className="h-12 w-12 object-cover rounded" />
                  <div>
                    <p className="sa-text text-sm">{m.alt_text}</p>
                    <p className="text-xs sa-text-muted">{m.kind}</p>
                  </div>
                  <button type="button" onClick={() => void deleteMedia(m.id)} className="text-xs text-red-400 hover:underline ml-auto">
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
