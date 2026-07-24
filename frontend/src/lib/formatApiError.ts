/**
 * Format FastAPI / API error bodies for display in the UI.
 */
export function formatApiError(detail: unknown, fallback = "Something went wrong"): string {
  if (detail == null) return fallback;
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: string }).msg);
        }
        return String(item);
      })
      .join("; ");
  }

  if (typeof detail === "object") {
    const obj = detail as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    try {
      return JSON.stringify(detail);
    } catch {
      return fallback;
    }
  }

  return String(detail);
}
