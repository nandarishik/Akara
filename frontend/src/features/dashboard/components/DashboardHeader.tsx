import type { CafeKpiFilters } from "../types";

type Props = {
  filters: CafeKpiFilters;
  onChange: (next: CafeKpiFilters) => void;
  locations?: { id: string; name: string }[];
  lastUpdatedMinutesAgo?: number | null;
};

const CHANNELS = [
  { value: "", label: "All channels" },
  { value: "dine-in", label: "Dine-in" },
  { value: "takeaway", label: "Takeaway" },
  { value: "swiggy", label: "Swiggy" },
  { value: "zomato", label: "Zomato" },
];

export function DashboardHeader({
  filters,
  onChange,
  locations = [],
  lastUpdatedMinutesAgo,
}: Props) {
  const showLocations = locations.length > 1;

  return (
    <div
      className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
      data-testid="dashboard-header"
    >
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          From
          <input
            type="date"
            className="rounded-md border border-border-subtle bg-surface-canvas px-2 py-1.5 text-sm text-text-primary"
            value={filters.from ?? ""}
            onChange={(e) => onChange({ ...filters, from: e.target.value || undefined })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          To
          <input
            type="date"
            className="rounded-md border border-border-subtle bg-surface-canvas px-2 py-1.5 text-sm text-text-primary"
            value={filters.to ?? ""}
            onChange={(e) => onChange({ ...filters, to: e.target.value || undefined })}
          />
        </label>
        {showLocations ? (
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Location
            <select
              className="rounded-md border border-border-subtle bg-surface-canvas px-2 py-1.5 text-sm text-text-primary"
              value={filters.location_id ?? ""}
              onChange={(e) =>
                onChange({ ...filters, location_id: e.target.value || undefined })
              }
            >
              <option value="">All outlets</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Channel
          <select
            className="rounded-md border border-border-subtle bg-surface-canvas px-2 py-1.5 text-sm text-text-primary"
            value={filters.channel ?? ""}
            onChange={(e) => onChange({ ...filters, channel: e.target.value || undefined })}
          >
            {CHANNELS.map((c) => (
              <option key={c.value || "all"} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-text-muted" data-testid="last-updated-badge">
        {lastUpdatedMinutesAgo != null
          ? `Last updated ${lastUpdatedMinutesAgo} min ago`
          : "Last updated —"}
      </p>
    </div>
  );
}
