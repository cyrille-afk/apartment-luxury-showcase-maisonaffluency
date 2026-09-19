/**
 * Multi-currency checkout normalisation.
 *
 * A cart can hold a EUR armchair and a USD lamp. Raw cent values from two
 * currencies must never be added together, so before any subtotal, freight,
 * tax or payment maths runs we convert every line into ONE base currency.
 *
 * Base currency rule: a single-currency cart keeps its own currency; a mixed
 * cart adopts the currency carrying the largest share of the order value
 * (a EUR €11,100 chair + a USD $5,950 lamp therefore settles in EUR).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { convertCentsWithFallback, getFxRates } from "@/lib/fxRates";
import {
  CartFxLock,
  clearFxLock,
  readFxLock,
  writeFxLock,
} from "@/lib/checkout/fxLock";
import { useShippingDestination } from "@/lib/shippingDestination";

export type MinimalLine = {
  currency?: string | null;
  unitCents: number;
  quantity?: number;
};

const qty = (l: MinimalLine) => Math.max(1, Math.floor(l.quantity ?? 1));
const code = (c?: string | null) => (c || "USD").toUpperCase();

/**
 * Settlement currency locked by the header "Shipping destination & currency"
 * modal. Whatever destination the shopper is shown in the header flag — picked
 * manually or resolved from their region — is the currency the whole funnel
 * prices and settles in, so the summary never contradicts the header.
 */
export function useSettlementCurrency(): string | null {
  const dest = useShippingDestination();
  return dest.currency ? dest.currency.toUpperCase() : null;
}



/** Currency every amount on the screen is expressed in. */
export function resolveBaseCurrency(
  lines: MinimalLine[] | null | undefined,
  preferredBase?: string | null,
): string {
  if (preferredBase) return preferredBase.toUpperCase();
  if (!lines?.length) return "USD";
  const totals = new Map<string, number>();
  for (const l of lines) {
    const c = code(l.currency);
    totals.set(c, (totals.get(c) ?? 0) + Math.round(l.unitCents) * qty(l));
  }
  const entries = [...totals.entries()];
  if (entries.length === 1) return entries[0][0];
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries[0][0];
}

/**
 * Rates for every foreign currency present → base.
 *
 * The first pass locks the rates for the session (see `fxLock.ts`), so the
 * total the shopper is quoted while browsing is the total they are charged.
 * `refreshLock` drops the lock and re-prices at today's rates.
 */
export function useFxToBase(lines: MinimalLine[] | null | undefined, base: string) {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [resolvedPairsKey, setResolvedPairsKey] = useState("");
  const [lock, setLock] = useState<CartFxLock | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const pairsKey = useMemo(
    () =>
      [...new Set((lines ?? []).map((l) => code(l.currency)))]
        .filter((c) => c !== base)
        .sort()
        .join(","),
    [lines, base],
  );
  useEffect(() => {
    let cancelled = false;
    const srcs = pairsKey ? pairsKey.split(",") : [];
    if (!srcs.length) {
      setRates({});
      setResolvedPairsKey("");
      setLock(null);
      return;
    }
    // A live lock wins over a fresh lookup: the quoted total must not move
    // underneath the buyer between browsing and paying.
    const held = readFxLock(base, pairsKey);
    if (held) {
      setRates(held.rates);
      setLock(held);
      setResolvedPairsKey(pairsKey);
      return;
    }
    getFxRates(srcs.map((src) => ({ src, tgt: base }))).then((r) => {
      if (cancelled) return;
      setRates(r);
      setLock(writeFxLock(base, pairsKey, r));
      setResolvedPairsKey(pairsKey);
    });
    return () => {
      cancelled = true;
    };
  }, [pairsKey, base, refreshToken]);
  const refreshLock = useCallback(() => {
    clearFxLock();
    setResolvedPairsKey("");
    setRefreshToken((n) => n + 1);
  }, []);
  return { rates, ready: resolvedPairsKey === pairsKey, lock, refreshLock };
}

export type NormalizedLine<T> = T & {
  /** Original currency before conversion, when the line was converted. */
  sourceCurrency?: string | null;
  /** Original unit price before conversion, when the line was converted. */
  sourceUnitCents?: number;
};

/**
 * Converts every line into one base currency using session-locked rates
 * (hardcoded cross-rate table as a safe fallback so checkout is never blocked).
 */
export function useCurrencyNormalizedLines<T extends MinimalLine>(
  lines: T[] | null,
  preferredBase?: string | null,
): {
  base: string;
  lines: NormalizedLine<T>[] | null;
  mixed: boolean;
  ready: boolean;
  /** Rates the basket was priced at, and when they were locked. */
  fxLock: CartFxLock | null;
  /** Re-prices the basket at current rates. */
  refreshFxLock: () => void;
} {
  const base = useMemo(
    () => resolveBaseCurrency(lines, preferredBase),
    [lines, preferredBase],
  );
  const { rates, ready, lock, refreshLock } = useFxToBase(lines, base);
  const mixed = useMemo(
    () => new Set((lines ?? []).map((l) => code(l.currency))).size > 1,
    [lines],
  );
  const normalized = useMemo(() => {
    if (!lines) return null;
    return lines.map((l) => {
      const src = code(l.currency);
      if (src === base) return { ...l } as NormalizedLine<T>;
      return {
        ...l,
        unitCents: convertCentsWithFallback(Math.round(l.unitCents), src, base, rates),
        currency: base,
        sourceCurrency: src,
        sourceUnitCents: Math.round(l.unitCents),
      } as NormalizedLine<T>;
    });
  }, [lines, base, rates]);
  return { base, lines: normalized, mixed, ready, fxLock: lock, refreshFxLock: refreshLock };
}
