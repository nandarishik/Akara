import { useEffect, useState } from "react";

import { superadminFetch } from "@/lib/api/superadmin";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SystemSettings {
  maintenance_mode: boolean;
  signup_open: boolean;
  system_banner: { message?: string; severity?: string; expires_at?: string } | null;
}

export function SuperadminSettingsPage() {
  const [maintenance, setMaintenance] = useState(false);
  const [signupOpen, setSignupOpen] = useState(true);
  const [bannerMessage, setBannerMessage] = useState("");
  const [reason, setReason] = useState("Global settings update from superadmin panel");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    superadminFetch<SystemSettings>("/superadmin/system/settings")
      .then((d) => {
        setMaintenance(Boolean(d.maintenance_mode));
        setSignupOpen(d.signup_open !== false);
        setBannerMessage(d.system_banner?.message || "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load settings"));
  }, []);

  async function saveGlobal() {
    setStatus("");
    setError("");
    const r = reason.trim();
    if (r.length < 10) {
      setError("Reason must be at least 10 characters");
      return;
    }
    try {
      await superadminFetch("/superadmin/system/settings", {
        method: "PATCH",
        body: JSON.stringify({
          maintenance_mode: maintenance,
          signup_open: signupOpen,
          reason: r,
        }),
      });
      setStatus("Global settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function saveBanner() {
    setStatus("");
    setError("");
    const r = reason.trim();
    if (r.length < 10) {
      setError("Reason must be at least 10 characters");
      return;
    }
    try {
      if (!bannerMessage.trim()) {
        await superadminFetch("/superadmin/notifications/system-banner", {
          method: "DELETE",
          body: JSON.stringify({ reason: r }),
        });
        setStatus("System banner cleared.");
        return;
      }
      await superadminFetch("/superadmin/notifications/system-banner", {
        method: "POST",
        body: JSON.stringify({
          message: bannerMessage.trim(),
          severity: "info",
          reason: r,
        }),
      });
      setStatus("System banner saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Banner save failed");
    }
  }

  return (
    <div className="max-w-lg space-y-6 text-sa-text">
      <h2 className="text-lg font-semibold">Global settings</h2>

      <div>
        <Label className="text-xs text-sa-muted">Audit reason</Label>
        <Input
          className="mt-1 border-sa-border bg-sa-raised text-sa-text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={maintenance} onChange={(e) => setMaintenance(e.target.checked)} />
          Maintenance mode
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={signupOpen} onChange={(e) => setSignupOpen(e.target.checked)} />
          Signup open
        </label>
        <button type="button" className="rounded bg-sa-accent px-4 py-2 text-sm text-white" onClick={() => void saveGlobal()}>
          Save global settings
        </button>
      </div>

      <div className="space-y-2 border-t border-sa-border pt-4">
        <Label className="text-xs text-sa-muted">Environment banner message</Label>
        <Input
          className="border-sa-border bg-sa-raised text-sa-text"
          value={bannerMessage}
          onChange={(e) => setBannerMessage(e.target.value)}
          placeholder="Leave empty to clear banner"
        />
        <button type="button" className="rounded border border-sa-border px-4 py-2 text-sm" onClick={() => void saveBanner()}>
          Save banner
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {status && <p className="text-sm text-sa-muted">{status}</p>}
    </div>
  );
}
