/**
 * Shared display-currency preference for the Trade views.
 *
 * The user's currency choice on the Trade Gallery should survive when they
 * drill into a product page (and across reloads). We persist it in
 * localStorage and broadcast changes to other tabs / mounted instances via
 * the standard `storage` event plus a custom in-tab event.
 */
import { useEffect, useState, useCallback } from "react";
import type { DisplayCurrency } from "@/components/trade/CurrencyToggle";

const STORAGE_KEY = "trade.displayCurrency";
const EVENT_NAME = "trade-display-currency-change";

const isValid = (v: unknown): v is DisplayCurrency =>
  typeof v === "string" &&
  ["original", "SGD", "EUR", "USD", "GBP", "CHF", "AED", "HKD", "AUD"].includes(v);

const read = (): DisplayCurrency => {
  if (typeof window === "undefined") return "original";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isValid(v) ? v : "original";
  } catch {
    return "original";
  }
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

  const update = useCallback((next: DisplayCurrency) => {
    setValue(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
    // Notify other instances in the same tab.
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
  }, []);

  return [value, update];
}
