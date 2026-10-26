"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface State<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Minimal data-fetching hook for the dashboard. Refetches when `deps` change and
 * exposes a manual `reload`. State is only ever set from async resolution (never
 * synchronously inside the effect body), which keeps it clear of the strict
 * `react-hooks/set-state-in-effect` rule.
 */
export function useApi<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[] = []
): State<T> & { reload: () => void } {
  const [state, setState] = useState<State<T>>({
    data: null,
    error: null,
    loading: true,
  });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // Keep the latest fetcher without making it a dependency (callers pass inline
  // closures that change identity every render).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcherRef.current(controller.signal).then(
      (data) => {
        if (alive) setState({ data, error: null, loading: false });
      },
      (err) => {
        if (alive && err?.name !== "AbortError") {
          setState({ data: null, error: String(err?.message ?? err), loading: false });
        }
      }
    );
    return () => {
      alive = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps]);

  return { ...state, reload };
}
