import { useEffect, useState } from "react";

import GlowCTAButton from "@/shared/ui/GlowCTAButton";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import {
  fetchNotificationPreferences,
  putNotificationPreferences,
} from "@/features/intelligence/api/intelligenceApi";
import {
  PREF_KEYS,
  PREF_LABELS,
  type ChannelPreference,
  type NotificationPreferences,
  type PrefKey,
} from "@/features/intelligence/api/types";

const CHANNELS: (keyof ChannelPreference)[] = ["email", "whatsapp", "in_app"];
const CHANNEL_LABELS = { email: "Email", whatsapp: "WhatsApp", in_app: "In-app" };

function emptyPrefs(whatsappEnabled: boolean): NotificationPreferences {
  const row = (): ChannelPreference => ({ email: true, whatsapp: false, in_app: true });
  return {
    revenue_drop: row(),
    food_cost_high: row(),
    orders_low: row(),
    item_not_selling: row(),
    anomaly: row(),
    whatsapp_alerts_enabled: whatsappEnabled,
  };
}

export function NotificationPreferencesPanel() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetchNotificationPreferences()
      .then(setPrefs)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Load failed"));
  }, []);

  if (!prefs) {
    return <p className="text-sm text-text-muted">{error || "Loading channel matrix…"}</p>;
  }

  const whatsappOff = !prefs.whatsapp_alerts_enabled;

  function toggle(key: PrefKey, channel: keyof ChannelPreference) {
    if (channel === "whatsapp" && whatsappOff) return;
    setPrefs((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [key]: { ...prev[key], [channel]: !prev[key][channel] },
      };
    });
  }

  async function save() {
    if (!prefs) return;
    setSaving(true);
    setError("");
    try {
      const body = Object.fromEntries(PREF_KEYS.map((k) => [k, prefs[k]])) as Record<
        PrefKey,
        ChannelPreference
      >;
      setPrefs(await putNotificationPreferences(body));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlowSurfaceCard padding="md" className="space-y-4 overflow-x-auto" hover={false}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-text-muted">
            <th className="p-2">Alert type</th>
            {CHANNELS.map((c) => (
              <th key={c} className="p-2">
                {CHANNEL_LABELS[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PREF_KEYS.map((key) => (
            <tr key={key} className="border-t border-white/10">
              <td className="p-2 font-medium">{PREF_LABELS[key]}</td>
              {CHANNELS.map((c) => {
                const disabled = c === "whatsapp" && whatsappOff;
                return (
                  <td key={c} className="p-2">
                    <input
                      type="checkbox"
                      checked={prefs[key][c]}
                      disabled={disabled}
                      title={
                        disabled
                          ? "WhatsApp alerts are disabled for this workspace"
                          : undefined
                      }
                      className={disabled ? "opacity-40 cursor-not-allowed" : ""}
                      onChange={() => toggle(key, c)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <GlowCTAButton size="sm" onClick={() => void save()} disabled={saving} loading={saving}>
        Save matrix
      </GlowCTAButton>
    </GlowSurfaceCard>
  );
}

export { emptyPrefs };
