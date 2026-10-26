"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { dictionary, type Dictionary, type Locale } from "./dictionary";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggle: () => void;
  t: Dictionary;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const STORAGE_KEY = "rex.locale";

/**
 * Locale lives in a tiny module-level external store read via
 * useSyncExternalStore — the React-recommended way to sync with a browser API
 * (localStorage) without setState-in-effect and without hydration mismatch.
 */
const listeners = new Set<() => void>();

function readLocale(): Locale {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(STORAGE_KEY) === "hi" ? "hi" : "en";
}

const localeStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  getSnapshot: readLocale,
  getServerSnapshot: (): Locale => "en",
  set(l: Locale) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, l);
    }
    listeners.forEach((fn) => fn());
  },
};

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    localeStore.subscribe,
    localeStore.getSnapshot,
    localeStore.getServerSnapshot
  );

  // Keep <html lang> in sync so :lang(hi) swaps the Devanagari fonts.
  // (DOM write only — no setState, so this is a valid effect.)
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => localeStore.set(l), []);
  const toggle = useCallback(
    () => localeStore.set(readLocale() === "en" ? "hi" : "en"),
    []
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, toggle, t: dictionary[locale] }),
    [locale, setLocale, toggle]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}
