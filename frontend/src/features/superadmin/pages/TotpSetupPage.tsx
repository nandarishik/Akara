import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  getTotpStatus,
  setupTotp,
  startSudo,
  SuperadminApiError,
} from "@/lib/api/superadmin";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export function TotpSetupPage() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [provisioningUri, setProvisioningUri] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const status = await getTotpStatus();
      setConfigured(status.configured);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load TOTP status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  async function handleSetup() {
    setSetupLoading(true);
    setError("");
    setStatusMsg("");
    try {
      const res = await setupTotp();
      setQrSvg(res.qr_code_svg);
      setProvisioningUri(res.provisioning_uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (code.trim().length !== 6 || !password) return;
    setVerifying(true);
    setError("");
    setStatusMsg("");
    try {
      await startSudo(password, code.trim());
      setStatusMsg("TOTP verified. Sudo session started.");
      setConfigured(true);
      setQrSvg(null);
      setProvisioningUri(null);
      setCode("");
      setPassword("");
    } catch (err) {
      if (err instanceof SuperadminApiError && err.status === 429) {
        setError("Too many attempts. Try again later.");
      } else if (err instanceof SuperadminApiError && err.status === 401) {
        const n = err.remainingAttempts;
        setError(
          n != null
            ? `Verification failed — ${n} of 5 remaining`
            : "Verification failed. Check password and code.",
        );
      } else {
        setError(err instanceof Error ? err.message : "Verification failed");
      }
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sa-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-sa-text">TOTP setup</h1>
        <p className="mt-1 text-sm text-sa-muted">
          Register an authenticator app for superadmin sudo.
        </p>
      </div>

      {configured && !qrSvg && (
        <div className="rounded-lg border border-sa-border bg-sa-raised px-4 py-3 text-sm text-sa-text">
          TOTP configured
        </div>
      )}

      {!configured && !qrSvg && (
        <Button type="button" disabled={setupLoading} onClick={() => void handleSetup()}>
          {setupLoading ? "Generating…" : "Set up authenticator"}
        </Button>
      )}

      {qrSvg && (
        <div className="space-y-4 rounded-xl border border-sa-border bg-sa-surface p-4">
          <p className="text-sm text-sa-muted">Scan this QR code with your authenticator app.</p>
          <div className="flex justify-center rounded-lg border border-sa-border bg-white p-4">
            <img
              alt="TOTP QR code"
              src={`data:image/svg+xml;utf8,${encodeURIComponent(qrSvg)}`}
              className="h-48 w-48"
            />
          </div>
          {provisioningUri && (
            <div className="space-y-1">
              <Label className="text-xs text-sa-muted">Manual provisioning URI</Label>
              <p className="break-all rounded border border-sa-border bg-sa-raised p-2 font-mono text-xs text-sa-text">
                {provisioningUri}
              </p>
            </div>
          )}
          <form onSubmit={handleVerify} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="totp-confirm" className="text-sa-muted">
                6-digit code
              </Label>
              <Input
                id="totp-confirm"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="border-sa-border bg-sa-raised text-sa-text"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="totp-password" className="text-sa-muted">
                Password
              </Label>
              <Input
                id="totp-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-sa-border bg-sa-raised text-sa-text"
              />
            </div>
            <Button
              type="submit"
              disabled={verifying || code.length !== 6 || !password}
              className="w-full"
            >
              {verifying ? "Verifying…" : "Verify and start sudo"}
            </Button>
          </form>
        </div>
      )}

      {statusMsg && <p className="text-sm text-emerald-400">{statusMsg}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
