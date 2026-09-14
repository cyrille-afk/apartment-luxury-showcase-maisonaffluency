/**
 * One money formatter for every ledger, proposal, print and export surface.
 *
 * The Project Studio ledger is the reference: figures are rendered with
 * `Intl.NumberFormat("en-US")`, the member's base currency code and no
 * decimals. PDFs, print sheets and decks must match it exactly, so they all
 * call `formatMoneyIn` rather than rolling their own symbol maps.
 */

import { useCallback, useMemo } from "react";
import { convertCents, useFxRates, type DisplayCurrency } from "@/components/trade/CurrencyToggle";
import { useTradeDisplayCurrency } from "@/hooks/useTradeDisplayCurrency";

/** Ledger-identical formatting. `cents` is minor units of `currency`. */
export function formatMoneyIn(
  cents: number | null | undefined,
  currency: string,
  fallback = "Price upon Request",
): string {
  if (!cents) return fallback;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${currency} ${Math.round(cents / 100).toLocaleString("en-US")}`;
  }
}

/**
 * Member's declared base preference currency plus conversion/formatting
 * helpers. Used by every export entry point so a printed proposal, tearsheet
 * or deck carries the same currency the member reads on screen.
 */
export function useExportCurrency(fallbackCurrency = "SGD") {
  const [displayCurrency] = useTradeDisplayCurrency();
  const rates = useFxRates();

  const currency = useMemo(
    () => (displayCurrency !== "original" ? displayCurrency : fallbackCurrency),
    [displayCurrency, fallbackCurrency],
  );

  const convert = useCallback(
    (cents: number | null | undefined, from?: string | null) =>
      cents ? convertCents(cents, (from || fallbackCurrency).toUpperCase(), currency as DisplayCurrency, rates) : 0,
    [currency, rates, fallbackCurrency],
  );

  const format = useCallback(
    (cents: number | null | undefined, fallback?: string) => formatMoneyIn(cents, currency, fallback),
    [currency],
  );

  return { currency, convert, format };
}
