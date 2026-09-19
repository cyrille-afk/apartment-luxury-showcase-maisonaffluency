/**
 * Guards for the server FX sync (mirrors supabase/functions/sync-currency-rates).
 * The helpers are re-implemented here because Deno function sources are not
 * part of the Vite/Vitest module graph; the logic must stay identical.
 */
import { describe, it, expect } from "vitest";
import { convertCentsWithFallback } from "@/lib/fxRates";

const CURRENCIES = ["EUR", "USD", "SGD", "GBP", "CHF", "AED", "HKD", "AUD", "JPY", "CAD"] as const;
const MAX_DRIFT = 0.1;

function validateEurBase(raw: unknown): { ok: boolean; error?: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "payload is not an object" };
  const src = raw as Record<string, unknown>;
  for (const cur of CURRENCIES) {
    if (cur === "EUR") continue;
    const v = src[cur];
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
      return { ok: false, error: `missing or invalid rate for ${cur}` };
    }
  }
  return { ok: true };
}

function derivePairs(eur: Record<string, number>) {
  const out: Array<{ base_currency: string; target_currency: string; rate: number }> = [];
  for (const a of CURRENCIES) for (const b of CURRENCIES) {
    if (a !== b) out.push({ base_currency: a, target_currency: b, rate: eur[b] / eur[a] });
  }
  return out;
}

function findExcessiveDrift(
  next: Array<{ base_currency: string; target_currency: string; rate: number }>,
  stored: Record<string, number>,
) {
  for (const p of next) {
    const prev = stored[`${p.base_currency}_${p.target_currency}`];
    if (!prev) continue;
    if (Math.abs(p.rate - prev) / prev > MAX_DRIFT) return { pair: `${p.base_currency}_${p.target_currency}` };
  }
  return null;
}

const SAMPLE: Record<string, number> = {
  EUR: 1, USD: 1.1583, SGD: 1.473, GBP: 0.8589, CHF: 0.9421,
  AED: 4.2538, HKD: 9.083, AUD: 1.6178, JPY: 184.2694, CAD: 1.606,
};

describe("currency rate sync guards", () => {
  it("accepts a complete payload", () => {
    expect(validateEurBase(SAMPLE).ok).toBe(true);
  });

  it("rejects a payload missing a currency", () => {
    const { HKD, ...rest } = SAMPLE;
    expect(validateEurBase(rest).ok).toBe(false);
  });

  it("rejects non-positive or non-finite rates", () => {
    expect(validateEurBase({ ...SAMPLE, USD: 0 }).ok).toBe(false);
    expect(validateEurBase({ ...SAMPLE, USD: Number.NaN }).ok).toBe(false);
  });

  it("derives every ordered pair and keeps cross-rates consistent", () => {
    const pairs = derivePairs(SAMPLE);
    expect(pairs).toHaveLength(CURRENCIES.length * (CURRENCIES.length - 1));
    const map = Object.fromEntries(pairs.map((p) => [`${p.base_currency}_${p.target_currency}`, p.rate]));
    // EUR→HKD must equal EUR→USD × USD→HKD
    expect(map.EUR_HKD).toBeCloseTo(map.EUR_USD * map.USD_HKD, 8);
    // Inverses must round-trip
    expect(map.HKD_EUR * map.EUR_HKD).toBeCloseTo(1, 8);
  });

  it("aborts when a pair moves more than 10%", () => {
    const pairs = derivePairs({ ...SAMPLE, HKD: SAMPLE.HKD * 1.5 });
    const stored = Object.fromEntries(
      derivePairs(SAMPLE).map((p) => [`${p.base_currency}_${p.target_currency}`, p.rate]),
    );
    expect(findExcessiveDrift(pairs, stored)).not.toBeNull();
  });

  it("allows a normal daily move", () => {
    const pairs = derivePairs({ ...SAMPLE, HKD: SAMPLE.HKD * 1.005 });
    const stored = Object.fromEntries(
      derivePairs(SAMPLE).map((p) => [`${p.base_currency}_${p.target_currency}`, p.rate]),
    );
    expect(findExcessiveDrift(pairs, stored)).toBeNull();
  });
});

describe("client conversion fallback chain", () => {
  it("uses the supplied rate map when present", () => {
    expect(convertCentsWithFallback(10000, "EUR", "HKD", { EUR_HKD: 9 })).toBe(90000);
  });

  it("falls back to the bundled table when the map is empty", () => {
    expect(convertCentsWithFallback(10000, "EUR", "HKD", {})).toBeGreaterThan(10000);
  });

  it("never converts when currencies match", () => {
    expect(convertCentsWithFallback(10000, "HKD", "HKD", {})).toBe(10000);
  });
});
