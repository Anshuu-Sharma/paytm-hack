"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * True only after client hydration. Uses useSyncExternalStore (not
 * setState-in-effect) so it stays clear of the strict hooks lint rule. Use it to
 * gate content that depends on client-only route state (e.g. useParams), which
 * is empty during SSR and would otherwise hydrate-mismatch.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
