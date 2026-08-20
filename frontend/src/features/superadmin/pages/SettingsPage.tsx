import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { sa, superadminFetch } from "@/lib/api/superadmin";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

interface SystemSettings {
  maintenance_mode: boolean;
  signup_open: boolean;
  system_banner: { message?: string; severity?: string; expires_at?: string } | null;
}

interface SystemHealth {
  api_status?: string;
  db_latency_ms?: number | null;
  checks?: Record<string, string>;
  active_import_jobs?: number;
  environment?: string;
  timestamp?: string;
}

function isBooleanFlag(value: string): boolean {
  const v = value.toLowerCase();
  return v === "ok" || v === "not_configured" || v === "degraded" || v.startsWith("error");
}

export function SuperadminSettingsPage() {
  const [maintenance, setMaintenance] = useState(false);
  const [signupOpen, setSignupOpen] = useState(true);
  const [reason, setReason] = useState("Global settings update from superadmin panel");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [healthError, setHealthError] = useState("");

  useEffect(() => {
    superadminFetch<SystemSettings>("/superadmin/system/settings")
      .then((d) => {
        setMaintenance(Boolean(d.maintenance_mode));
        setSignupOpen(d.signup_open !== false);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load settings"));

    void sa.systemHealth()
      .then((d) => setHealth(d as SystemHealth))
      .catch((e) => setHealthError(e instanceof Error ? e.message : "Health check failed"));
  }, []);

  const envFlags = useMemo(() => {
    if (!health?.checks) return [];
    return Object.entries(health.checks).filter(([, val]) => isBooleanFlag(val));
  }, [health]);

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

  async function refreshHealth() {
    setHealthError("");
    try {
      const d = await sa.systemHealth();
      setHealth(d as SystemHealth);
    } catch (e) {
      setHealthError(e instanceof Error ? e.message : "Health check failed");
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
        <Label className="text-xs text-sa-muted">System banner</Label>
        <p className="text-sm text-sa-muted">
          Manage the maintenance banner on the{" "}
          <Link to="/superadmin/comms" className="text-sa-accent hover:underline">
            Comms page
          </Link>
          .
        </p>
      </div>

      <section className="space-y-3 border-t border-sa-border pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">ENV CHECK</h3>
          <button
            type="button"
            className="text-xs text-sa-accent underline"
            onClick={() => void refreshHealth()}
          >
            Refresh
          </button>
        </div>
        {healthError && <p className="text-sm text-red-400">{healthError}</p>}
        {envFlags.length > 0 ? (
          <ul className="rounded-lg border border-sa-border bg-sa-raised divide-y divide-sa-border text-sm">
            {envFlags.map(([key, val]) => (
              <li key={key} className="flex justify-between px-3 py-2">
                <span className="text-sa-muted capitalize">{key.replace(/_/g, " ")}</span>
                <EnvFlag value={val} />
              </li>
            ))}
          </ul>
        ) : (
          !healthError && <p className="text-sm text-sa-muted">Loading env checksâ€¦</p>
        )}
      </section>

      <section className="space-y-3 border-t border-sa-border pt-4">
        <h3 className="text-sm font-semibold">System health</h3>
        {health ? (
          <ul className="rounded-lg border border-sa-border bg-sa-raised divide-y divide-sa-border text-sm">
            {health.db_latency_ms != null && (
              <li className="flex justify-between px-3 py-2">
                <span className="text-sa-muted">DB latency</span>
                <span className="tabular-nums">{health.db_latency_ms} ms</span>
              </li>
            )}
            {health.active_import_jobs != null && (
              <li className="flex justify-between px-3 py-2">
                <span className="text-sa-muted">Active import jobs</span>
                <span>{health.active_import_jobs}</span>
              </li>
            )}
            {health.environment && (
              <li className="flex justify-between px-3 py-2">
                <span className="text-sa-muted">Environment</span>
                <span>{health.environment}</span>
              </li>
            )}
          </ul>
        ) : (
          !healthError && <p className="text-sm text-sa-muted">Loading health checksâ€¦</p>
        )}
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {status && <p className="text-sm text-sa-muted">{status}</p>}
    </div>
  );
}

function EnvFlag({ value }: { value: string }) {
  const ok = value === "ok";
  const missing = value === "not_configured";
  const warn = value === "degraded" || value.startsWith("error");
  return (
    <span
      className={`text-xs font-medium ${
        ok ? "text-emerald-400" : missing ? "text-sa-muted" : warn ? "text-amber-400" : "text-sa-muted"
      }`}
    >
      {ok ? "âœ“ configured" : missing ? "âœ— not set" : value}
    </span>
  );
}
