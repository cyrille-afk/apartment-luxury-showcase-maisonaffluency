/**
 * QuoteExtrasEditor — currency reprice tests
 * ------------------------------------------
 * Verifies that when the parent flips the quote's display currency, the
 * additional-charges total reported to the parent (via onTotalChange) is
 * re-computed by converting each row's native amount using the supplied
 * `convertCents` helper — instead of leaving the raw cents unchanged.
 *
 * Fixtures:
 *   - Row A: crating         @ €640   (EUR)
 *   - Row B: rush surcharge  @ $200   (USD)
 *   - Row C: hand-loading    @ £100   (GBP)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import QuoteExtrasEditor from "@/components/trade/QuoteExtrasEditor";

// ----- Mock supabase client so the component's load() effect resolves with
// fixture data instead of making a network call. ------------------------------
vi.mock("@/integrations/supabase/client", () => {
  const rows = [
    { id: "a", label: "Crating",        amount_cents: 640_00, currency: "EUR", sort_order: 0 },
    { id: "b", label: "Rush surcharge", amount_cents: 200_00, currency: "USD", sort_order: 1 },
    { id: "c", label: "Hand-loading",   amount_cents: 100_00, currency: "GBP", sort_order: 2 },
  ];
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    then: (onFulfilled: any, onRejected: any) =>
      Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected),
  };
  return {
    supabase: {
      from: () => ({
        select: () => chain,
        insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
        update: () => ({ eq: async () => ({ error: null }) }),
        delete: () => ({ eq: async () => ({ error: null }) }),
      }),
    },
  };
});

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: () => {} }) }));

/** Deterministic FX table used by all three test cases. */
const RATES: Record<string, number> = {
  EUR_USD: 1.10, USD_EUR: 1 / 1.10,
  EUR_GBP: 0.85, GBP_EUR: 1 / 0.85,
  USD_GBP: 0.80, GBP_USD: 1 / 0.80,
  EUR_SGD: 1.45, USD_SGD: 1.32, GBP_SGD: 1.70,
};

const convertCents = (cents: number | null, from: string, to: string): number | null => {
  if (cents == null) return null;
  if (from === to) return cents;
  const r = RATES[`${from}_${to}`];
  return r ? Math.round(cents * r) : cents;
};

const mountAndRead = async (currency: string): Promise<number> => {
  const onTotalChange = vi.fn();
  render(
    <QuoteExtrasEditor
      quoteId="q1"
      currency={currency}
      convertCents={convertCents}
      onTotalChange={onTotalChange}
    />,
  );
  await waitFor(() => {
    const last = onTotalChange.mock.calls.at(-1);
    expect(last && last[0]).toBeGreaterThan(0);
  });
  const calls = onTotalChange.mock.calls;
  return calls[calls.length - 1][0] as number;
};

describe("QuoteExtrasEditor — extras reprice on currency switch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sums rows in EUR: €640 + $200→€181.82 + £100→€117.65", async () => {
    const total = await mountAndRead("EUR");
    // €640 + round(20000 * 1/1.10) + round(10000 * 1/0.85)
    const expected = 640_00 + Math.round(200_00 / 1.10) + Math.round(100_00 / 0.85);
    expect(total).toBe(expected);
  });

  it("sums rows in USD: €640→$704 + $200 + £100→$125", async () => {
    const total = await mountAndRead("USD");
    const expected = Math.round(640_00 * 1.10) + 200_00 + Math.round(100_00 / 0.80);
    expect(total).toBe(expected);
  });

  it("sums rows in GBP: €640→£544 + $200→£160 + £100", async () => {
    const total = await mountAndRead("GBP");
    const expected = Math.round(640_00 * 0.85) + Math.round(200_00 * 0.80) + 100_00;
    expect(total).toBe(expected);
  });

  it("EUR total ≠ USD total (proves reprice actually happens)", async () => {
    const eur = await mountAndRead("EUR");
    const usd = await mountAndRead("USD");
    expect(eur).not.toBe(usd);
  });

  it("falls back to native cents when a rate is missing (e.g. HKD)", async () => {
    const total = await mountAndRead("HKD");
    // No HKD rates defined → each row falls through 1:1.
    expect(total).toBe(640_00 + 200_00 + 100_00);
  });
});
