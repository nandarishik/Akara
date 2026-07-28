import { useState } from "react";

import { superadminFetch } from "@/lib/api/superadmin";

export function SuperadminCommsPage() {
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("info");
  const [status, setStatus] = useState("");

  async function saveBanner() {
    await superadminFetch("/superadmin/notifications/system-banner", {
      method: "POST",
      body: JSON.stringify({
        message,
        severity,
        reason: "System banner update from superadmin comms UI",
      }),
    });
    setStatus("Banner saved");
  }

  async function clearBanner() {
    await superadminFetch("/superadmin/notifications/system-banner", {
      method: "DELETE",
      body: JSON.stringify({ reason: "Clear system banner from superadmin comms UI" }),
    });
    setMessage("");
    setStatus("Banner cleared");
  }

  return (
    <div className="max-w-lg space-y-4 text-sa-text">
      <h2 className="text-lg font-semibold">System banner</h2>
      <textarea
        className="w-full rounded border border-sa-border bg-sa-raised p-3 text-sm"
        rows={3}
        placeholder="Maintenance message…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <select
        className="rounded border border-sa-border bg-sa-raised px-3 py-2 text-sm"
        value={severity}
        onChange={(e) => setSeverity(e.target.value)}
      >
        <option value="info">Info</option>
        <option value="warning">Warning</option>
        <option value="error">Error</option>
      </select>
      <div className="flex gap-2">
        <button type="button" className="rounded bg-sa-accent px-4 py-2 text-sm text-white" onClick={() => void saveBanner()}>
          Publish banner
        </button>
        <button type="button" className="rounded border border-sa-border px-4 py-2 text-sm" onClick={() => void clearBanner()}>
          Clear
        </button>
      </div>
      {status && <p className="text-sm text-sa-muted">{status}</p>}
    </div>
  );
}
