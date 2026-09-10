import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION_KEY = "ma_checkout_line";
const DURABLE_KEY = "ma_secure_basket";
const ORDER_PLACED_KEY = "ma_secure_basket_order_placed";
const REGION_COUNTRY_KEY = "trade.detectedCountry";
const REGION_CURRENCY_KEY = "trade.displayCurrency";
const REGION_MANUAL_KEY = "trade.shippingDestination.manual";

function envelope(lines: unknown[], region?: { countryIso: string; countryName: string; currency: string; manual?: boolean }) {
  return JSON.stringify({ v: 1, lines, region, savedAt: Date.now() });
}

const sampleLine = { pickId: "pick-1", finishLabel: "Tarnished Silver", quantity: 1 };

function isLine(l: unknown): l is { pickId: string; finishLabel: string; quantity: number } {
  return typeof l === "object" && l !== null && "pickId" in l && "finishLabel" in l;
}

async function importFresh() {
  vi.resetModules();
  const mod: typeof import("@/lib/checkout/secureBasket") = await import("@/lib/checkout/secureBasket");
  return mod;
}

describe("secure basket persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
  });

  it("reads session cache first when available", async () => {
    sessionStorage.setItem(SESSION_KEY, envelope([sampleLine]));
    localStorage.setItem(DURABLE_KEY, envelope([{ ...sampleLine, finishLabel: "Wrong" }]));
    const { readSecureBasket } = await importFresh();
    const lines = readSecureBasket(isLine);
    expect(lines).toHaveLength(1);
    expect(lines[0].finishLabel).toBe("Tarnished Silver");
  });

  it("falls back to durable localStorage cache when session is empty", async () => {
    localStorage.setItem(DURABLE_KEY, envelope([sampleLine]));
    const { readSecureBasket } = await importFresh();
    const lines = readSecureBasket(isLine);
    expect(lines).toHaveLength(1);
  });

  it("returns empty after an order has been placed", async () => {
    localStorage.setItem(DURABLE_KEY, envelope([sampleLine]));
    localStorage.setItem(ORDER_PLACED_KEY, "1");
    const { readSecureBasket } = await importFresh();
    expect(readSecureBasket(isLine)).toHaveLength(0);
  });

  it("ignores empty writes so un-hydrated renders cannot erase the basket", async () => {
    localStorage.setItem(DURABLE_KEY, envelope([sampleLine]));
    const { writeSecureBasket, readSecureBasket } = await importFresh();
    writeSecureBasket([]);
    expect(readSecureBasket(isLine)).toHaveLength(1);
  });

  it("persists genuine lines to both session and durable caches", async () => {
    const { writeSecureBasket } = await importFresh();
    writeSecureBasket([sampleLine]);
    expect(sessionStorage.getItem(SESSION_KEY)).toContain("Tarnished Silver");
    expect(localStorage.getItem(DURABLE_KEY)).toContain("Tarnished Silver");
  });

  it("records destination / settlement currency metadata", async () => {
    localStorage.setItem(REGION_COUNTRY_KEY, "CH");
    localStorage.setItem(REGION_CURRENCY_KEY, "CHF");
    const { writeSecureBasket } = await importFresh();
    writeSecureBasket([sampleLine]);
    const parsed = JSON.parse(localStorage.getItem(DURABLE_KEY) || "{}");
    expect(parsed.region).toEqual({
      countryIso: "CH",
      countryName: "Switzerland",
      currency: "CHF",
      manual: false,
    });
  });

  it("restores Switzerland / CHF region when reading the basket", async () => {
    localStorage.setItem(
      DURABLE_KEY,
      envelope([sampleLine], { countryIso: "CH", countryName: "Switzerland", currency: "CHF", manual: true }),
    );
    const { readSecureBasket } = await importFresh();
    readSecureBasket(isLine);
    expect(localStorage.getItem(REGION_COUNTRY_KEY)).toBe("CH");
    expect(localStorage.getItem(REGION_CURRENCY_KEY)).toBe("CHF");
    expect(localStorage.getItem(REGION_MANUAL_KEY)).toBe("1");
  });

  it("clears the session cache and marks order placed", async () => {
    sessionStorage.setItem(SESSION_KEY, envelope([sampleLine]));
    localStorage.setItem(DURABLE_KEY, envelope([sampleLine]));
    const { clearSecureBasket, readSecureBasket } = await importFresh();
    clearSecureBasket("order");
    expect(localStorage.getItem(ORDER_PLACED_KEY)).toBe("1");
    expect(readSecureBasket(isLine)).toHaveLength(0);
  });

  it("reads legacy flat arrays and legacy single-line objects", async () => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([sampleLine]));
    const { readSecureBasket } = await importFresh();
    expect(readSecureBasket(isLine)).toHaveLength(1);

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sampleLine));
    vi.resetModules();
    const { readSecureBasket: read2 } = await import("@/lib/checkout/secureBasket");
    expect(read2(isLine)).toHaveLength(1);
  });
});
