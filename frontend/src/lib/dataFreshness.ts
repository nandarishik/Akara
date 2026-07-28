/** Days since an ISO date string; null when missing or invalid (avoids epoch → 20k days). */
export function daysSinceIso(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

/** Prefer last import timestamp; fall back to latest sales date in the selected range. */
export function salesDataAgeDays(
  lastImport?: string | null,
  rangeEnd?: string | null
): number | null {
  return daysSinceIso(lastImport) ?? daysSinceIso(rangeEnd);
}
