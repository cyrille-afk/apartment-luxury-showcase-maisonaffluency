/**
 * Background cross-border invoice resolution for the cart & checkout summaries.
 *
 * Authenticated trade buyers only. Recomputes when the destination, currency or
 * basket signature changes. Failures resolve to `null`, so the surrounding UI
 * keeps the trade baseline rates without ever freezing.
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchCrossBorderInvoice,
  type CrossBorderInvoice,
  type CrossBorderItem,
} from "@/lib/checkout/crossBorderInvoice";

export function useCrossBorderInvoice(
  items: CrossBorderItem[],
  destinationCountry: string | null | undefined,
  currency: string,
): { invoice: CrossBorderInvoice | null; loading: boolean } {
  const { user, isTradeUser, isAdmin, tradeStatus } = useAuth();
  const eligible = Boolean(user) && (isAdmin || (isTradeUser && tradeStatus === "approved"));

  const [invoice, setInvoice] = useState<CrossBorderInvoice | null>(null);
  const [loading, setLoading] = useState(false);

  const signature = useMemo(
    () =>
      JSON.stringify({
        eligible,
        destinationCountry: (destinationCountry || "").toUpperCase(),
        currency: (currency || "").toUpperCase(),
        items: items.map((i) => [i.pickId ?? null, i.unitCents, i.quantity]),
      }),
    [eligible, destinationCountry, currency, items],
  );

  useEffect(() => {
    const payload = JSON.parse(signature) as {
      eligible: boolean;
      destinationCountry: string;
      currency: string;
    };
    if (!payload.eligible || !payload.destinationCountry || items.length === 0) {
      setInvoice(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchCrossBorderInvoice({
      destinationCountry: payload.destinationCountry,
      currency: payload.currency,
      items,
    })
      .then((result) => {
        if (!cancelled) setInvoice(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return { invoice, loading };
}
