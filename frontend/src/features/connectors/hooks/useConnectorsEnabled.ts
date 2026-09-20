import { useQuery } from "@tanstack/react-query";

import { getSystemSettings } from "../api/connectorsApi";

/**
 * Hide Connectors nav when `connectors_enabled` is false/missing.
 * Until DEV1 adds the field, treat missing as false (safe default).
 * Dev mock: set VITE_CONNECTORS_ENABLED_MOCK=true to force show.
 */
export function useConnectorsEnabled() {
  const mock = import.meta.env.VITE_CONNECTORS_ENABLED_MOCK === "true";
  const { data, isLoading, isError } = useQuery({
    queryKey: ["system-settings", "connectors"],
    queryFn: getSystemSettings,
    staleTime: 5 * 60 * 1000,
    enabled: !mock,
  });

  if (mock) {
    return { enabled: true, isLoading: false };
  }

  return {
    enabled: Boolean(data?.connectors_enabled) && !isError,
    isLoading,
  };
}
