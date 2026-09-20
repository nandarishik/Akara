import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import {
  getSudoStatus,
  startSudo,
  SuperadminApiError,
} from "@/lib/api/superadmin";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const TOTP_LEN = 6;

export function SudoGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [digits, setDigits] = useState<string[]>(() => Array(TOTP_LEN).fill(""));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  const totpCode = digits.join("");
  const totpComplete = totpCode.length === TOTP_LEN && digits.every((d) => /^\d$/.test(d));

  function setDigitAt(index: number, raw: string) {
    const char = raw.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });
    if (char && index < TOTP_LEN - 1) {
      digitRefs.current[index + 1]?.focus();
    }
  }

  function handleDigitKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  }

  function handleDigitPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, TOTP_LEN);
    if (!pasted) return;
    const next = Array(TOTP_LEN).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    const focusIdx = Math.min(pasted.length, TOTP_LEN - 1);
    digitRefs.current[focusIdx]?.focus();
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    if (!password || !totpComplete) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await startSudo(password, totpCode);
      setActive(true);
      setExpiresAt(res.expires_at);
      setPassword("");
      setDigits(Array(TOTP_LEN).fill(""));
    } catch (err) {
      if (err instanceof SuperadminApiError) {
        if (err.status === 429) {
          setError("Too many attempts. Account temporarily locked. Try again later.");
        } else if (err.status === 401) {
          const n = err.remainingAttempts;
          setError(
            n != null
              ? `Invalid credentials — ${n} of 5 remaining`
              : "Invalid credentials. Try again.",
          );
        } else {
          setError(err.message || "Authentication failed.");
        }
      } else {
        setError("Invalid password or TOTP. Try again.");
      }
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
            <div className="mt-4 space-y-2">
              <Label className="text-sa-muted">Authenticator code</Label>
              <div className="flex gap-2" onPaste={handleDigitPaste}>
                {digits.map((digit, i) => (
                  <Input
                    key={i}
                    ref={(el) => {
                      digitRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    aria-label={`TOTP digit ${i + 1}`}
                    value={digit}
                    onChange={(e) => setDigitAt(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    className="h-11 w-10 border-sa-border bg-sa-raised p-0 text-center text-sa-text"
                  />
                ))}
              </div>
            </div>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            <Button
              type="submit"
              disabled={submitting || !password || !totpComplete}
              className="mt-4 w-full"
            >
              {submitting ? "Verifying…" : "Continue to superadmin"}
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
