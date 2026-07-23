export interface DataBounds {
  start: string;
  end: string;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Resolve dashboard period to [start, end] dates.
 * When imported data exists, periods anchor to the latest data date (not today).
 */
export function getDateRangeForPeriod(
  period: string,
  bounds?: DataBounds | null
): [string, string] {
  if (bounds?.start && bounds?.end) {
    const dataMin = parseDate(bounds.start);
    const dataMax = parseDate(bounds.end);

    if (period === "all") {
      return [bounds.start, bounds.end];
    }

    const end = dataMax;
    const start = new Date(dataMax);
    switch (period) {
      case "7d":
        start.setDate(end.getDate() - 6);
        break;
      case "30d":
        start.setDate(end.getDate() - 29);
        break;
      case "90d":
        start.setDate(end.getDate() - 89);
        break;
      case "ytd":
        start.setMonth(0, 1);
        break;
      default:
        start.setDate(end.getDate() - 29);
    }

    const clampedStart = start < dataMin ? dataMin : start;
    return [toISODate(clampedStart), toISODate(end)];
  }

  const end = new Date();
  const start = new Date();
  switch (period) {
    case "7d":
      start.setDate(end.getDate() - 7);
      break;
    case "30d":
      start.setDate(end.getDate() - 30);
      break;
    case "90d":
      start.setDate(end.getDate() - 90);
      break;
    case "ytd":
      start.setMonth(0, 1);
      break;
    case "all":
      start.setFullYear(end.getFullYear() - 10);
      break;
    default:
      start.setDate(end.getDate() - 30);
  }
  return [toISODate(start), toISODate(end)];
}
