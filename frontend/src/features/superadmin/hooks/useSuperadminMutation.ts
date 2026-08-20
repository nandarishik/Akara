import { useState, useCallback } from "react";

export function useSuperadminMutation<T>(
  mutationFn: () => Promise<T>,
  onSuccess?: (result: T) => void,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await mutationFn();
      onSuccess?.(result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Operation failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [mutationFn, onSuccess]);

  return { run, loading, error, setError };
}
