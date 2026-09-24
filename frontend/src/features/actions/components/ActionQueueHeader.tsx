import { TYPE_FILTER_LABELS, type SortKey, type TypeFilter } from "../types";

export type ActionQueueHeaderProps = {
  openCount: number;
  sort: SortKey;
  type: TypeFilter;
  onSort: (sort: SortKey) => void;
  onType: (type: TypeFilter) => void;
};

export function ActionQueueHeader({
  openCount,
  sort,
  type,
  onSort,
  onType,
}: ActionQueueHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-text-secondary">
        <span className="font-semibold text-text-primary">{openCount}</span> open
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-text-muted">
          Filter
          <select
            className="ml-2 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-text-primary"
            value={type}
            onChange={(e) => onType(e.target.value as TypeFilter)}
            aria-label="Filter by type"
          >
            {TYPE_FILTER_LABELS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-text-muted">
          Sort
          <select
            className="ml-2 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-text-primary"
            value={sort}
            onChange={(e) => onSort(e.target.value as SortKey)}
            aria-label="Sort recommendations"
          >
            <option value="confidence">Confidence</option>
            <option value="impact">Impact</option>
            <option value="date">Date</option>
          </select>
        </label>
      </div>
    </div>
  );
}
