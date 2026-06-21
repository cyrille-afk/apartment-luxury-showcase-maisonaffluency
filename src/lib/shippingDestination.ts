/**
 * Shipping destination (country) + auto-derived currency.
 *
 * Powers the flag switcher in the header. Persists the user's chosen country
 * to localStorage and broadcasts changes so the trade display-currency hook
 * picks up the matching currency automatically.
 *
 * Currency is NEVER chosen manually here — it is always derived from country.
 */
import { useEffect, useState, useCallback } from "react";

const COUNTRY_KEY = "trade.detectedCountry";            // shared with useTradeDisplayCurrency
const COUNTRY_TS_KEY = "trade.detectedCountry.ts";
const MANUAL_DEST_KEY = "trade.shippingDestination.manual";
const CURRENCY_KEY = "trade.displayCurrency";
const CURRENCY_EVENT = "trade-display-currency-change";
const DEST_EVENT = "trade-shipping-destination-change";

export type CountryEntry = { iso: string; name: string; currency: string };

/** Curated list of trade-supported destinations. Order = dropdown order. */
export const SHIPPING_COUNTRIES: CountryEntry[] = [
  { iso: "GB", name: "United Kingdom", currency: "GBP" },
  { iso: "US", name: "United States", currency: "USD" },
  { iso: "FR", name: "France", currency: "EUR" },
  { iso: "DE", name: "Germany", currency: "EUR" },
  { iso: "IT", name: "Italy", currency: "EUR" },
  { iso: "ES", name: "Spain", currency: "EUR" },
  { iso: "NL", name: "Netherlands", currency: "EUR" },
  { iso: "BE", name: "Belgium", currency: "EUR" },
  { iso: "IE", name: "Ireland", currency: "EUR" },
  { iso: "PT", name: "Portugal", currency: "EUR" },
  { iso: "AT", name: "Austria", currency: "EUR" },
  { iso: "LU", name: "Luxembourg", currency: "EUR" },
  { iso: "MC", name: "Monaco", currency: "EUR" },
  { iso: "GR", name: "Greece", currency: "EUR" },
  { iso: "CH", name: "Switzerland", currency: "CHF" },
  { iso: "AE", name: "United Arab Emirates", currency: "AED" },
  { iso: "SA", name: "Saudi Arabia", currency: "AED" },
  { iso: "QA", name: "Qatar", currency: "AED" },
  { iso: "KW", name: "Kuwait", currency: "AED" },
  { iso: "BH", name: "Bahrain", currency: "AED" },
  { iso: "OM", name: "Oman", currency: "AED" },
  { iso: "HK", name: "Hong Kong", currency: "HKD" },
  { iso: "SG", name: "Singapore", currency: "SGD" },
  { iso: "AU", name: "Australia", currency: "AUD" },
];

const DEFAULT_ISO = "GB";

const findEntry = (iso: string | null | undefined): CountryEntry | undefined =>
  iso ? SHIPPING_COUNTRIES.find((c) => c.iso === iso.toUpperCase()) : undefined;

/** Convert ISO-3166 alpha-2 to flag emoji (regional indicator). */
export const isoToFlag = (iso: string): string => {
  if (!iso || iso.length !== 2) return "🏳️";
  const A = 0x1f1e6;
  const cp = iso.toUpperCase().split("").map((c) => A + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...cp);
};

export const getCurrentDestination = (): CountryEntry => {
  if (typeof window === "undefined") return findEntry(DEFAULT_ISO)!;
  try {
    const iso = window.localStorage.getItem(COUNTRY_KEY);
    return findEntry(iso) ?? findEntry(DEFAULT_ISO)!;
  } catch {
    return findEntry(DEFAULT_ISO)!;
  }
};

export const setDestination = (iso: string) => {
  const entry = findEntry(iso);
  if (!entry || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COUNTRY_KEY, entry.iso);
    window.localStorage.setItem(COUNTRY_TS_KEY, String(Date.now()));
    window.localStorage.setItem(MANUAL_DEST_KEY, "1");
    // Sync display currency (auto, not flagged manual) so the toggle reflects it.
    window.localStorage.setItem(CURRENCY_KEY, entry.currency);
    window.localStorage.removeItem("trade.displayCurrency.manual");
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(DEST_EVENT, { detail: entry }));
  window.dispatchEvent(new CustomEvent(CURRENCY_EVENT, { detail: entry.currency }));
};

/** Reactive hook returning the current destination. */
export const useShippingDestination = (): CountryEntry => {
  const [dest, setDest] = useState<CountryEntry>(() => getCurrentDestination());

  useEffect(() => {
    const refresh = () => setDest(getCurrentDestination());
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<CountryEntry>).detail;
      if (detail?.iso) setDest(detail);
      else refresh();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === COUNTRY_KEY) refresh();
    };
    window.addEventListener(DEST_EVENT, onCustom as EventListener);
    window.addEventListener(CURRENCY_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    // Poll once after mount in case the IP-geo detector populated the cache.
    const t = window.setTimeout(refresh, 1500);
    return () => {
      window.removeEventListener(DEST_EVENT, onCustom as EventListener);
      window.removeEventListener(CURRENCY_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
      window.clearTimeout(t);
    };
  }, []);

  return dest;
};
