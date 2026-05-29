/**
 * React hook wrapper around `computePerLineShipments`.
 * Recomputes whenever the line packing signature, destination, or quote→EUR FX changes.
 */
import { useEffect, useState } from "react";
import {
  computePerLineShipments,
  PerLineShippingResult,
  RawLine,
} from "@/lib/perLineShipping";

export const usePerLineShipping = (
  lines: RawLine[],
  destCountry: string | null | undefined,
  fxQuoteToEur: number | null | undefined,
  enabled: boolean = true,
): { result: PerLineShippingResult; loading: boolean } => {
  const [result, setResult] = useState<PerLineShippingResult>({
    shipments: [], totalShippingEurCents: 0, totalDutyEurCents: 0,
    totalVatEurCents: 0, totalDeclaredEurCents: 0,
  });
  const [loading, setLoading] = useState(false);

  // Stable key over the inputs the estimator cares about
  const key = JSON.stringify({
    enabled, destCountry, fxQuoteToEur,
    lines: lines.map((l) => [
      l.id, l.qty, l.lineCents,
      l.shipOriginCountry ?? l.productOrigin ?? null,
      l.shipMode ?? null, l.shipCbm ?? null, l.shipWeightKg ?? null,
    ]),
  });

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !destCountry || !fxQuoteToEur || lines.length === 0) {
      setResult({
        shipments: [], totalShippingEurCents: 0, totalDutyEurCents: 0,
        totalVatEurCents: 0, totalDeclaredEurCents: 0,
      });
      return;
    }
    setLoading(true);
    computePerLineShipments(lines, destCountry, fxQuoteToEur)
      .then((r) => { if (!cancelled) setResult(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { result, loading };
};
