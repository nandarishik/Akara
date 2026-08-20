import { useCallback, useEffect, useRef, useState } from "react";

import { fetchPublicPlacements, trackPlacementClick, trackPlacementImpression } from "@/lib/api/public";

function frequencyCapOk(slotKey: string, cap: number): boolean {
  if (!cap || cap <= 0) return true;
  const key = `akara_placement_freq_${slotKey}`;
  const raw = localStorage.getItem(key);
  const count = raw ? parseInt(raw, 10) : 0;
  return count < cap;
}

function bumpFrequencyCap(slotKey: string): void {
  const key = `akara_placement_freq_${slotKey}`;
  const raw = localStorage.getItem(key);
  const count = raw ? parseInt(raw, 10) : 0;
  localStorage.setItem(key, String(count + 1));
}

export function usePlacementSlot(
  slotKey: string,
  fallback: Record<string, unknown> | null = null,
  options?: { plan?: string; page?: string },
) {
  const [content, setContent] = useState<Record<string, unknown> | null>(fallback);
  const [source, setSource] = useState<"fallback" | "api">("fallback");
  const impressed = useRef(false);

  useEffect(() => {
    fetchPublicPlacements({ plan: options?.plan, page: options?.page })
      .then((items) => {
        const match = items.find((i) => i.key === slotKey);
        const cap = Number(match?.audience_rules?.frequency_cap ?? 0);
        if (match?.published_content && frequencyCapOk(slotKey, cap)) {
          setContent(match.published_content);
          setSource("api");
        } else if (fallback) {
          setContent(fallback);
          setSource("fallback");
        }
      })
      .catch(() => {
        if (fallback) setContent(fallback);
      });
  }, [slotKey, fallback, options?.plan, options?.page]);

  useEffect(() => {
    if (!content || impressed.current) return;
    impressed.current = true;
    bumpFrequencyCap(slotKey);
    void trackPlacementImpression(slotKey);
  }, [slotKey, content]);

  const onClick = useCallback(() => {
    void trackPlacementClick(slotKey);
  }, [slotKey]);

  return { content, source, trackClick: onClick };
}
