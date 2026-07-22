import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle } from "lucide-react";

const BASE = import.meta.env.VITE_API_BASE_URL as string;

export function SettingsPage() {
  const { user, session } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Morning brief opt-in toggle
  const [briefEnabled, setBriefEnabled] = useState(true);
  const [briefSaving, setBriefSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const { error: supaError } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", user!.id);
      if (supaError) throw supaError;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleBriefToggle(enabled: boolean) {
    if (!session?.access_token) return;
    setBriefSaving(true);
    try {
      await fetch(`${BASE}/admin/users/${user!.id}/preferences`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ morning_brief_enabled: enabled }),
      });
      setBriefEnabled(enabled);
    } catch {
      // silent — not critical
    } finally {
      setBriefSaving(false);
    }
  }

  const roleLabel = user?.role === "admin" ? "Admin" : "Viewer";

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your profile and notification preferences.
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Avatar + identity row */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center text-lg font-bold select-none">
              {user?.email?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="font-medium text-slate-900">{user?.email}</p>
              <Badge variant="outline" className="text-xs mt-0.5">
                {roleLabel}
              </Badge>
            </div>
          </div>

          {/* Display name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="max-w-sm"
            />
          </div>

          {/* Feedback */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Saved successfully!
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-fit"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Notifications Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>
            Control which automated reports you receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-slate-900">
                Daily Morning Brief
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Receive a daily revenue summary at 7:00 AM with actionable
                insights for your business
              </p>
            </div>
            <button
              role="switch"
              aria-checked={briefEnabled}
              onClick={() => !briefSaving && handleBriefToggle(!briefEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                briefEnabled ? "bg-indigo-600" : "bg-slate-200"
              } ${briefSaving ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform ring-0 transition-transform duration-200 ${
                  briefEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Account Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Details</CardTitle>
          <CardDescription>Read-only system identifiers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <div className="flex items-center justify-between gap-4">
            <span className="shrink-0">Tenant ID</span>
            <code className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-700 truncate max-w-[260px]">
              {user?.tenantId}
            </code>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="shrink-0">User ID</span>
            <code className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-700 truncate max-w-[260px]">
              {user?.id}
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
