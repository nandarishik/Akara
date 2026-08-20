import { useCallback, useEffect, useState, type ReactNode } from "react";

import { getSudoStatus, startSudo } from "@/lib/api/superadmin";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export function SudoGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const status = await getSudoStatus();
      setActive(status.active);
      setExpiresAt(status.expires_at);
    } catch {
      setActive(false);
      setExpiresAt(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await startSudo(password);
      setActive(true);
      setExpiresAt(res.expires_at);
      setPassword("");
    } catch {
      setError("Invalid password. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sa-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      {!active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleConfirm}
            className="w-full max-w-md rounded-xl border border-sa-border bg-sa-surface p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-sa-text">Confirm your password</h2>
            <p className="mt-1 text-sm text-sa-muted">
              Superadmin access requires re-authentication every 15 minutes.
            </p>
            <div className="mt-4 space-y-2">
              <Label htmlFor="sudo-password" className="text-sa-muted">
                Password
              </Label>
              <Input
                id="sudo-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-sa-border bg-sa-raised text-sa-text"
              />
            </div>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            <Button type="submit" disabled={submitting || !password} className="mt-4 w-full">
              {submitting ? "Verifyingâ€¦" : "Continue to superadmin"}
            </Button>
          </form>
        </div>
      )}
      {active && expiresAt && (
        <div className="mb-4 rounded-lg border border-sa-border bg-sa-raised px-3 py-2 text-xs text-sa-muted">
          Sudo session active until {new Date(expiresAt).toLocaleTimeString()}
        </div>
      )}
      {children}
    </>
  );
}
