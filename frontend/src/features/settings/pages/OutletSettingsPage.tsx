import { useEffect, useState } from "react";

import {
  createLocation,
  listChannels,
  listLocations,
  upsertChannel,
} from "@/features/data-import/api/cafeImportApi";
import type { CafeChannel, CafeLocation } from "@/features/data-import/api/types";
import { ChannelRateEditor } from "@/features/settings/components/ChannelRateEditor";
import GlowSurfaceCard from "@/shared/ui/GlowSurfaceCard";
import GlowCTAButton from "@/shared/ui/GlowCTAButton";
import ProductPageLayout from "@/shared/layout/ProductPageLayout";
import { toast } from "@/shared/ui/toast";
import { formatApiError } from "@/lib/formatApiError";

function OutletSettingsBody() {
  const [locations, setLocations] = useState<CafeLocation[]>([]);
  const [channels, setChannels] = useState<CafeChannel[]>([]);
  const [locationName, setLocationName] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const [loc, ch] = await Promise.all([listLocations(), listChannels()]);
      setLocations(loc.locations ?? []);
      setChannels(ch.channels ?? []);
    } catch {
      /* endpoints may 404 until DEV1 merges */
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function addLocation() {
    if (!locationName.trim()) return;
    setBusy(true);
    try {
      await createLocation({
        location_name: locationName.trim(),
        city: city || null,
        state_code: stateCode || null,
      });
      setLocationName("");
      setCity("");
      setStateCode("");
      await refresh();
      toast.success("Outlet added");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <GlowSurfaceCard padding="lg" hover={false}>
        <h2 className="text-base font-medium text-white mb-4">Outlets / locations</h2>
        <ul className="divide-y divide-white/10 mb-4">
          {locations.map((loc) => (
            <li key={loc.location_id} className="py-2 text-sm text-white flex justify-between">
              <span>{loc.location_name}</span>
              <span className="text-text-muted">
                {[loc.city, loc.state_code].filter(Boolean).join(", ") || "—"}
              </span>
            </li>
          ))}
          {locations.length === 0 && (
            <li className="py-3 text-sm text-text-muted">No outlets yet</li>
          )}
        </ul>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <input
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
            placeholder="Location name"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
          />
          <input
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <input
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
            placeholder="State code"
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
          />
        </div>
        <GlowCTAButton type="button" disabled={busy} onClick={() => void addLocation()}>
          Add outlet
        </GlowCTAButton>
      </GlowSurfaceCard>

      <GlowSurfaceCard padding="lg" hover={false}>
        <ChannelRateEditor
          channels={channels}
          onSave={async (row) => {
            await upsertChannel(row);
            await refresh();
          }}
        />
      </GlowSurfaceCard>
    </div>
  );
}

/** Embedded in Settings tabs (no extra page chrome). */
export function OutletSettingsPage() {
  return <OutletSettingsBody />;
}

/** Standalone `/settings/outlets` route. */
export function OutletSettingsRoutePage() {
  return (
    <ProductPageLayout title="Outlets" description="Locations and channel commission rates">
      <OutletSettingsBody />
    </ProductPageLayout>
  );
}
