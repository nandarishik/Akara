import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import AkaraButton from "@/components/ui/GradientButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SurfaceCard from "@/components/ui/SurfaceCard";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Trash2, Download, KeyRound } from "lucide-react";
import { roleLabel } from "@/lib/auth-utils";
import { PlanGate } from "@/components/billing/PlanGate";
import { useBilling } from "@/hooks/useBilling";
import { TeamPage } from "@/pages/TeamPage";
import { cn } from "@/lib/utils";

type Channels = { whatsapp_enabled: boolean; whatsapp_reason: string };

type Prefs = {
  morning_brief_enabled: boolean;
  email_debrief_enabled: boolean;
  whatsapp_debrief_enabled: boolean;
  email_morning_brief_enabled: boolean;
  whatsapp_morning_brief_enabled: boolean;
  whatsapp_alerts_enabled: boolean;
  announcements_enabled: boolean;
  usage_warnings_enabled: boolean;
  morning_brief_time?: string;
  morning_brief_timezone?: string;
  debrief_day?: string;
};

const DEFAULT_PREFS: Prefs = {
  morning_brief_enabled: true,
  email_debrief_enabled: true,
  whatsapp_debrief_enabled: true,
  email_morning_brief_enabled: true,
  whatsapp_morning_brief_enabled: true,
  whatsapp_alerts_enabled: true,
  announcements_enabled: true,
  usage_warnings_enabled: true,
  morning_brief_time: "07:00",
  morning_brief_timezone: "Asia/Kolkata",
  debrief_day: "monday",
};

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "notifications", label: "Notifications" },
  { id: "billing", label: "Billing" },
  { id: "security", label: "Security" },
  { id: "team", label: "Team" },
  { id: "api", label: "API Keys" },
  { id: "danger", label: "Danger Zone" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Toggle({
  checked,
  disabled,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-accent" : "bg-surface-raised"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsPage() {
  const { user, session } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<TabId>("profile");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [phone, setPhone] = useState("");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [channels, setChannels] = useState<Channels | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [testEmailMsg, setTestEmailMsg] = useState("");
  const [testWhatsAppMsg, setTestWhatsAppMsg] = useState("");
  const [unsubMsg, setUnsubMsg] = useState("");
  const [tenantMeta, setTenantMeta] = useState<{ company?: string; industry?: string; language?: string }>({});

  useEffect(() => {
    if (searchParams.get("focus") === "whatsapp") {
      setTab("notifications");
    }
    if (searchParams.get("unsubscribe") === "morning-brief" && user) {
      apiFetch("/account/preferences/unsubscribe", {
        method: "POST",
        body: JSON.stringify({ channel: "email", category: "morning_brief" }),
      })
        .then(() => setUnsubMsg("You are unsubscribed from morning brief emails."))
        .catch(() => setUnsubMsg("Could not process unsubscribe."));
    }
  }, [searchParams, user]);

  useEffect(() => {
    apiFetch<Channels>("/account/channels").then(setChannels).catch(() => null);
    supabase
      .from("profiles")
      .select("preferences, phone_number, tenant_id")
      .eq("id", user!.id)
      .single()
      .then(({ data }) => {
        if (data?.preferences) setPrefs({ ...DEFAULT_PREFS, ...data.preferences });
        if (data?.phone_number) setPhone(data.phone_number);
        if (data?.tenant_id) {
          supabase
            .from("tenants")
            .select("name, config")
            .eq("id", data.tenant_id)
            .single()
            .then(({ data: tenant }) => {
              if (tenant) {
                const cfg = (tenant.config || {}) as Record<string, string>;
                setTenantMeta({
                  company: tenant.name || cfg.company_name,
                  industry: cfg.industry,
                  language: cfg.language,
                });
              }
            });
        }
      });
  }, [user?.id]);

  async function patchPrefs(update: Partial<Prefs>) {
    const next = { ...prefs, ...update };
    setPrefs(next);
    await apiFetch("/account/preferences", {
      method: "PATCH",
      body: JSON.stringify(update),
    });
  }

  async function handleSaveProfile() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await apiFetch("/account/profile", {
        method: "PATCH",
        body: JSON.stringify({ display_name: displayName, phone_number: phone }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange() {
    setPasswordMsg("");
    const { error: err } = await supabase.auth.updateUser({ password });
    setPasswordMsg(err ? err.message : "Password updated");
    if (!err) setPassword("");
  }

  async function handleTestEmail() {
    setTestEmailMsg("");
    try {
      await apiFetch("/account/preferences/test-email", { method: "POST" });
      setTestEmailMsg("Test email sent — check your inbox.");
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Send failed";
      const match = raw.match(/^API \d+: (.+)$/);
      if (match) {
        try {
          const body = JSON.parse(match[1]) as { detail?: string };
          if (typeof body.detail === "string") {
            setTestEmailMsg(body.detail);
            return;
          }
        } catch {
          /* use raw message */
        }
      }
      setTestEmailMsg(raw);
    }
  }

  async function handleTestWhatsApp() {
    setTestWhatsAppMsg("");
    try {
      const res = await apiFetch<{ status: string; message?: string }>("/account/preferences/test-whatsapp", { method: "POST" });
      setTestWhatsAppMsg(res.message || (res.status === "skipped" ? "WhatsApp not live yet — logged as skipped." : "Test WhatsApp sent."));
    } catch (e) {
      setTestWhatsAppMsg(e instanceof Error ? e.message : "Send failed");
    }
  }

  async function handleExport() {
    const token = session?.access_token;
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/account/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "akara_export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete() {
    if (!confirm("This schedules permanent account deletion. Continue?")) return;
    await apiFetch("/account", {
      method: "DELETE",
      body: JSON.stringify({ confirm_email: deleteEmail }),
    });
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const role = roleLabel(user, session);
  const { data: usage } = useBilling();
  const whatsappLocked = !channels?.whatsapp_enabled;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6 bg-surface-canvas min-h-full">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary mt-1">
          Profile, notifications, team, and account rights.
        </p>
      </div>

      <div className="flex gap-1 border-b border-surface-border pb-1 overflow-x-auto flex-nowrap -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3 py-2.5 text-sm rounded-t-lg transition-colors shrink-0 min-h-[44px]",
              tab === t.id
                ? "bg-surface-raised text-accent font-medium"
                : "text-text-muted hover:text-text-primary"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <SurfaceCard className="space-y-5">
          <h2 className="text-base font-semibold">Profile</h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center text-lg font-bold">
              {user?.email?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="font-medium">{user?.email}</p>
              <Badge variant="outline" className="text-xs mt-0.5">{role}</Badge>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="max-w-sm" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone (+91 for WhatsApp)</Label>
            <Input id="whatsapp-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+919876543210" className="max-w-sm" />
            <p className="text-xs text-text-muted">WhatsApp delivery activates when Meta templates are approved.</p>
          </div>
          {(tenantMeta.company || tenantMeta.industry || tenantMeta.language) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-sm">
              {tenantMeta.company && (
                <div>
                  <p className="text-xs text-text-muted">Company</p>
                  <p className="font-medium">{tenantMeta.company}</p>
                </div>
              )}
              {tenantMeta.industry && (
                <div>
                  <p className="text-xs text-text-muted">Industry</p>
                  <p className="font-medium capitalize">{tenantMeta.industry}</p>
                </div>
              )}
              {tenantMeta.language && (
                <div>
                  <p className="text-xs text-text-muted">Language</p>
                  <p className="font-medium uppercase">{tenantMeta.language}</p>
                </div>
              )}
            </div>
          )}
          {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="h-4 w-4" />{error}</p>}
          {saved && <p className="text-sm text-emerald-600 flex items-center gap-1"><CheckCircle className="h-4 w-4" />Saved!</p>}
          <AkaraButton onClick={handleSaveProfile} disabled={saving} size="sm">
            {saving ? "Saving…" : "Save profile"}
          </AkaraButton>
        </SurfaceCard>
      )}

      {tab === "notifications" && (
        <SurfaceCard className="space-y-2">
          <h2 className="text-base font-semibold mb-2">Notifications</h2>
          {unsubMsg && <p className="text-sm text-emerald-700 bg-emerald-50 rounded px-3 py-2">{unsubMsg}</p>}
          {usage?.plan === "free" && !localStorage.getItem("akara_slot_K_dismissed") && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex justify-between gap-2">
              <span>Pro plans get WhatsApp morning briefs on your phone.</span>
              <div className="flex gap-2 shrink-0">
                <Link to="/upgrade" className="text-accent font-medium underline">Upgrade</Link>
                <button type="button" className="text-xs text-amber-800" onClick={() => localStorage.setItem("akara_slot_K_dismissed", "1")}>Dismiss</button>
              </div>
            </div>
          )}
          <PlanGate feature="morning_brief" requiredPlan="pro" mode="hide">
            <Toggle
              checked={prefs.morning_brief_enabled}
              onChange={(v) => patchPrefs({ morning_brief_enabled: v })}
              label="Daily Morning Brief (email)"
              description="7:00 AM revenue summary with top actions"
            />
            <Toggle
              checked={prefs.email_morning_brief_enabled}
              onChange={(v) => patchPrefs({ email_morning_brief_enabled: v })}
              label="Morning brief — email channel"
            />
            <Toggle
              checked={prefs.whatsapp_morning_brief_enabled}
              disabled={whatsappLocked || !phone}
              onChange={(v) => patchPrefs({ whatsapp_morning_brief_enabled: v })}
              label="Morning brief — WhatsApp"
              description={whatsappLocked ? "WhatsApp activates when templates are approved" : undefined}
            />
            <div className="pt-2">
              <AkaraButton variant="secondary" size="sm" onClick={handleTestEmail}>
                Send test brief
              </AkaraButton>
              {testEmailMsg && <p className="text-xs text-text-secondary mt-2">{testEmailMsg}</p>}
              <AkaraButton variant="secondary" size="sm" className="ml-2" onClick={handleTestWhatsApp}>
                Send test WhatsApp
              </AkaraButton>
              {testWhatsAppMsg && <p className="text-xs text-text-secondary mt-2">{testWhatsAppMsg}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-surface-border">
              <div className="space-y-1">
                <Label htmlFor="briefTime">Morning brief time (IST)</Label>
                <Input
                  id="briefTime"
                  type="time"
                  value={prefs.morning_brief_time ?? "07:00"}
                  onChange={(e) => patchPrefs({ morning_brief_time: e.target.value })}
                  className="max-w-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  className="w-full max-w-xs text-sm border rounded-md px-2 py-2 bg-surface-canvas"
                  value={prefs.morning_brief_timezone ?? "Asia/Kolkata"}
                  onChange={(e) => patchPrefs({ morning_brief_timezone: e.target.value })}
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="Asia/Dubai">Asia/Dubai</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="debriefDay">Weekly debrief day</Label>
                <select
                  id="debriefDay"
                  className="w-full max-w-xs text-sm border rounded-md px-2 py-2 bg-surface-canvas"
                  value={prefs.debrief_day ?? "monday"}
                  onChange={(e) => patchPrefs({ debrief_day: e.target.value })}
                >
                  <option value="monday">Monday</option>
                </select>
              </div>
            </div>
          </PlanGate>
          <Toggle
            checked={prefs.email_debrief_enabled}
            onChange={(v) => patchPrefs({ email_debrief_enabled: v })}
            label="Weekly debrief (email)"
          />
          <Toggle
            checked={prefs.whatsapp_debrief_enabled}
            disabled={whatsappLocked || !phone}
            onChange={(v) => patchPrefs({ whatsapp_debrief_enabled: v })}
            label="Weekly debrief (WhatsApp)"
            description={whatsappLocked ? "WhatsApp activates when templates are approved" : undefined}
          />
          <Toggle
            checked={prefs.whatsapp_alerts_enabled}
            disabled={whatsappLocked || !phone}
            onChange={(v) => patchPrefs({ whatsapp_alerts_enabled: v })}
            label="Alert notifications (WhatsApp)"
          />
          <Toggle
            checked={prefs.announcements_enabled}
            onChange={(v) => patchPrefs({ announcements_enabled: v })}
            label="Product announcements"
          />
          <Toggle
            checked={prefs.usage_warnings_enabled}
            onChange={(v) => patchPrefs({ usage_warnings_enabled: v })}
            label="Usage & quota warnings"
          />
        </SurfaceCard>
      )}

      {tab === "billing" && (
        <SurfaceCard>
          <h2 className="text-base font-semibold">Billing</h2>
          <p className="text-sm text-text-secondary mt-2">Manage plan, invoices, and payment methods.</p>
          <Link to="/billing" className="inline-block mt-4">
            <AkaraButton variant="secondary" size="sm">Open Billing & Usage →</AkaraButton>
          </Link>
        </SurfaceCard>
      )}

      {tab === "security" && (
        <SurfaceCard className="space-y-4">
          <h2 className="text-base font-semibold">Security</h2>
          <p className="text-sm text-text-secondary">Active sessions: 1 device (current)</p>
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="max-w-sm" />
          </div>
          <AkaraButton variant="secondary" size="sm" onClick={handlePasswordChange} disabled={!password}>
            Update password
          </AkaraButton>
          {passwordMsg && <p className="text-sm text-text-secondary">{passwordMsg}</p>}
        </SurfaceCard>
      )}

      {tab === "team" && (
        <SurfaceCard>
          <TeamPage embedded />
        </SurfaceCard>
      )}

      {tab === "api" && (
        <SurfaceCard className="text-center py-8 space-y-3">
          <KeyRound className="h-8 w-8 mx-auto text-text-muted" />
          <h2 className="font-semibold">API Keys</h2>
          <p className="text-sm text-text-secondary">Coming soon — Day 13</p>
        </SurfaceCard>
      )}

      {tab === "danger" && (
        <SurfaceCard className="space-y-4 border-red-200">
          <h2 className="text-base font-semibold text-red-700 flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Danger Zone
          </h2>
          <AkaraButton variant="secondary" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Export my data (JSON)
          </AkaraButton>
          <div className="space-y-2 pt-2 border-t border-surface-border">
            <Label htmlFor="confirmEmail">Delete account — type your email to confirm</Label>
            <Input id="confirmEmail" value={deleteEmail} onChange={(e) => setDeleteEmail(e.target.value)} placeholder={user?.email} className="max-w-sm" />
            <p className="text-xs text-text-muted">Deletion is queued and processed asynchronously (DPDP).</p>
            <AkaraButton size="sm" onClick={handleDelete} disabled={deleteEmail.toLowerCase() !== (user?.email || "").toLowerCase()}>
              Delete account permanently
            </AkaraButton>
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}

export function SettingsTeamPage() {
  return <TeamPage />;
}
