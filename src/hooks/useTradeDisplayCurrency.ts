/**
 * Shared display-currency preference for the Trade views.
 *
 * Persistence + sync:
 *   - The user's currency choice on the Trade Gallery survives when they drill
 *     into a product page (and across reloads). We persist it in localStorage
 *     and broadcast changes to other tabs / mounted instances via the standard
 *     `storage` event plus a custom in-tab event.
 *
 * Default selection (only when the user hasn't manually picked a currency):
 *   1. profile.country  →  currency
 *   2. IP geolocation   →  currency  (cached in localStorage for 30 days)
 *   3. browser locale   →  currency
 *   4. fallback         →  "original"
 *
 * Manual choice always wins. Once the user picks a currency in the toggle, we
 * mark it as manual and never overwrite it from country detection again.
 */
import { useEffect, useState, useCallback } from "react";
import type { DisplayCurrency } from "@/components/trade/CurrencyToggle";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "trade.displayCurrency";
const MANUAL_FLAG_KEY = "trade.displayCurrency.manual";
const COUNTRY_CACHE_KEY = "trade.detectedCountry";
const COUNTRY_CACHE_TS_KEY = "trade.detectedCountry.ts";
const COUNTRY_CACHE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const EVENT_NAME = "trade-display-currency-change";

const SUPPORTED: DisplayCurrency[] = [
  "original", "SGD", "EUR", "USD", "GBP", "CHF", "AED", "HKD", "AUD",
];

const isValid = (v: unknown): v is DisplayCurrency =>
  typeof v === "string" && (SUPPORTED as string[]).includes(v);

/** ISO 3166-1 alpha-2 country code → preferred trade currency. */
const COUNTRY_TO_CURRENCY: Record<string, DisplayCurrency> = {
  // United Kingdom
  GB: "GBP", UK: "GBP",
  // Eurozone
  AT: "EUR", BE: "EUR", CY: "EUR", DE: "EUR", EE: "EUR", ES: "EUR", FI: "EUR",
  FR: "EUR", GR: "EUR", HR: "EUR", IE: "EUR", IT: "EUR", LT: "EUR", LU: "EUR",
  LV: "EUR", MC: "EUR", MT: "EUR", NL: "EUR", PT: "EUR", SI: "EUR", SK: "EUR",
  AD: "EUR", SM: "EUR", VA: "EUR",
  // United States
  US: "USD",
  // Hong Kong
  HK: "HKD",
  // Middle East → AED
  AE: "AED", SA: "AED", QA: "AED", KW: "AED", BH: "AED", OM: "AED",
  // Switzerland
  CH: "CHF", LI: "CHF",
  // Australia
  AU: "AUD",
  // Singapore
  SG: "SGD",
};

const currencyForCountry = (code?: string | null): DisplayCurrency | null => {
  if (!code) return null;
  return COUNTRY_TO_CURRENCY[code.toUpperCase()] ?? null;
};

/** Best-effort country from the browser's locale (e.g. "en-GB" → "GB"). */
const countryFromLocale = (): string | null => {
  if (typeof navigator === "undefined") return null;
  const langs = [navigator.language, ...(navigator.languages ?? [])].filter(Boolean);
  for (const l of langs) {
    const m = /[-_]([A-Za-z]{2})\b/.exec(l);
    if (m) return m[1].toUpperCase();
  }
  return null;
};

/** Cached IP-geolocation country lookup (30-day cache). */
const fetchCountryFromIP = async (): Promise<string | null> => {
  if (typeof window === "undefined") return null;
  try {
    const cached = window.localStorage.getItem(COUNTRY_CACHE_KEY);
    const ts = Number(window.localStorage.getItem(COUNTRY_CACHE_TS_KEY) || 0);
    if (cached && Date.now() - ts < COUNTRY_CACHE_MS) return cached;
  } catch { /* ignore */ }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch("https://ipapi.co/json/", { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const code: string | undefined = data?.country_code || data?.country;
    if (code && /^[A-Za-z]{2}$/.test(code)) {
      try {
        window.localStorage.setItem(COUNTRY_CACHE_KEY, code.toUpperCase());
        window.localStorage.setItem(COUNTRY_CACHE_TS_KEY, String(Date.now()));
      } catch { /* ignore */ }
      return code.toUpperCase();
    }
  } catch { /* network/abort */ }
  return null;
};

const read = (): DisplayCurrency => {
  if (typeof window === "undefined") return "original";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isValid(v) ? v : "original";
  } catch {
    return "original";
  }
};

const isManual = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MANUAL_FLAG_KEY) === "1";
  } catch { return false; }
};

export function useTradeDisplayCurrency(): [DisplayCurrency, (next: DisplayCurrency) => void] {
  const [value, setValue] = useState<DisplayCurrency>(read);

  // Sync across tabs and across mounted instances in the same tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      if (isValid(e.newValue)) setValue(e.newValue);
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (isValid(detail)) setValue(detail);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT_NAME, onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT_NAME, onCustom as EventListener);
    };
  }, []);

  // One-shot auto-default from country, only if the user has never manually picked.
  useEffect(() => {
    if (isManual()) return;
    let cancelled = false;

    (async () => {
      // 1) profile.country
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("country")
            .eq("id", user.id)
            .maybeSingle();
          const fromProfile = currencyForCountry(data?.country);
          if (fromProfile && !cancelled && !isManual()) {
            applyAuto(fromProfile);
            return;
          }
        }
      } catch { /* ignore */ }

      // 2) IP geolocation
      const ipCountry = await fetchCountryFromIP();
      const fromIP = currencyForCountry(ipCountry);
      if (fromIP && !cancelled && !isManual()) {
        applyAuto(fromIP);
        return;
      }

      // 3) browser locale
      const fromLocale = currencyForCountry(countryFromLocale());
      if (fromLocale && !cancelled && !isManual()) {
        applyAuto(fromLocale);
      }
    })();

    function applyAuto(next: DisplayCurrency) {
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
        // Do NOT set MANUAL_FLAG_KEY — this is a default, not a manual pick.
      } catch { /* ignore */ }
      setValue(next);
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
    }

    return () => { cancelled = true; };
  }, []);

  const update = useCallback((next: DisplayCurrency) => {
    setValue(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      window.localStorage.setItem(MANUAL_FLAG_KEY, "1");
    } catch {
      /* storage unavailable */
    }
    // Notify other instances in the same tab.
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
  }, []);

  return [value, update];
}
