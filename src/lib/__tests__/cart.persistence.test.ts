import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "ma_cart_v1";
const BACKUP_KEY = "ma_cart_v1_backup";
const ORDER_PLACED_KEY = "ma_cart_order_placed";
const REGION_COUNTRY_KEY = "trade.detectedCountry";
const REGION_CURRENCY_KEY = "trade.displayCurrency";
const REGION_MANUAL_KEY = "trade.shippingDestination.manual";

function envelope(lines: unknown[], region?: { countryIso: string; countryName: string; currency: string; manual?: boolean }) {
  return JSON.stringify({ v: 1, lines, region, savedAt: Date.now() });
}

const sampleLine = {
  pickId: "pick-1",
  productSlug: "lantern-table-lamp",
  designerSlug: "apparatus",
  title: "Lantern Table Lamp",
  designerName: "Apparatus",
  finishLabel: "Tarnished Silver",
  imageUrl: "https://image.jpg",
  leadTime: "8–10 weeks",
  unitPriceCents: 803500,
  currency: "USD",
  quantity: 1,
  origin: "US",
};

async function importFresh() {
  vi.resetModules();
  const mod: typeof import("@/lib/cart") = await import("@/lib/cart");
  return mod;
}

describe("cart persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
  });

  it("hydrates a populated primary cache on module load", async () => {
    localStorage.setItem(STORAGE_KEY, envelope([sampleLine]));
    const { getCart } = await importFresh();
    expect(getCart()).toHaveLength(1);
    expect(getCart()[0].title).toBe("Lantern Table Lamp");
  });

  it("hydrates from the durable backup when primary cache is empty", async () => {
    localStorage.setItem(BACKUP_KEY, envelope([sampleLine]));
    const { getCart, rehydrateCart } = await importFresh();
    // The module loads the backup immediately so the basket never starts empty.
    expect(getCart()).toHaveLength(1);
    rehydrateCart();
    expect(getCart()).toHaveLength(1);
    expect(localStorage.getItem(STORAGE_KEY)).toContain("Lantern Table Lamp");
  });

  it("recovers in-memory items when primary cache is empty but backup missing", async () => {
    const { addToCart, getCart, rehydrateCart } = await importFresh();
    addToCart({ ...sampleLine, key: "pick-1::tarnished silver" } as any);
    // Simulate another tab/storage wipe by clearing primary but leaving items live.
    localStorage.removeItem(STORAGE_KEY);
    rehydrateCart();
    expect(getCart()).toHaveLength(1);
    expect(localStorage.getItem(STORAGE_KEY)).toContain("Lantern Table Lamp");
  });

  it("stays empty after an order has been placed", async () => {
    localStorage.setItem(BACKUP_KEY, envelope([sampleLine]));
    localStorage.setItem(ORDER_PLACED_KEY, "1");
    const { getCart, rehydrateCart } = await importFresh();
    rehydrateCart();
    expect(getCart()).toHaveLength(0);
  });

  it("stores destination / settlement currency metadata with the basket", async () => {
    localStorage.setItem(REGION_COUNTRY_KEY, "CH");
    localStorage.setItem(REGION_CURRENCY_KEY, "CHF");
    localStorage.setItem(REGION_MANUAL_KEY, "1");
    const { addToCart, getCart } = await importFresh();
    addToCart({ ...sampleLine, key: "pick-1::tarnished silver" } as any);
    const raw = localStorage.getItem(STORAGE_KEY) || "";
    const parsed = JSON.parse(raw);
    expect(parsed.region).toEqual({
      countryIso: "CH",
      countryName: "Switzerland",
      currency: "CHF",
      manual: true,
    });
    expect(getCart()).toHaveLength(1);
  });

  it("restores Switzerland / CHF region metadata on rehydration", async () => {
    localStorage.setItem(
      BACKUP_KEY,
      envelope([sampleLine], { countryIso: "CH", countryName: "Switzerland", currency: "CHF", manual: true }),
    );
    const { rehydrateCart } = await importFresh();
    rehydrateCart();
    expect(localStorage.getItem(REGION_COUNTRY_KEY)).toBe("CH");
    expect(localStorage.getItem(REGION_CURRENCY_KEY)).toBe("CHF");
    expect(localStorage.getItem(REGION_MANUAL_KEY)).toBe("1");
  });

  it("clears the live basket and marks order placed", async () => {
    localStorage.setItem(STORAGE_KEY, envelope([sampleLine]));
    localStorage.setItem(BACKUP_KEY, envelope([sampleLine]));
    const { clearCart, getCart, rehydrateCart } = await importFresh();
    clearCart("order");
    expect(getCart()).toHaveLength(0);
    expect(localStorage.getItem(ORDER_PLACED_KEY)).toBe("1");
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
    rehydrateCart();
    expect(getCart()).toHaveLength(0);
  });

  it("reads legacy flat arrays for backward compatibility", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([sampleLine]));
    const { getCart } = await importFresh();
    expect(getCart()).toHaveLength(1);
  });
});
