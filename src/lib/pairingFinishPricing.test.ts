import { beforeEach, describe, expect, it, vi } from "vitest";
import { parsePairingFinishOptions, pairingFinishError, resolvePairingFinish } from "./pairingFinishPricing";
import { selectCuratedPairings, type PairingProduct } from "./curatedPairings";

const option = { id: "finish-1", name: "Lacquer / Aged Brass", price_cents: 240000 };
const rule = { id: "11111111-1111-4111-8111-111111111111", preferred_pick_id: "pick-1", enabled: true, source_category: "ceiling", target_category: "tables", sort_order: 0, finish_options: [option], finish_currency: "USD" };
const ref = { ruleId: rule.id, optionId: option.id };
const piece: PairingProduct = { id: "pick-1", title: "Segment Console Table", brand: "Apparatus", image: "/piece.jpg", path: "/designers/apparatus/segment" };
const primary = { ...piece, id: "primary", title: "Tassel 57 Pendant" };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe("editable pairing finish pricing", () => {
  it("validates positive integer retail prices and permits Price upon Request", () => {
    expect(pairingFinishError([option], piece.id)).toBeNull();
    expect(pairingFinishError([{ ...option, price_cents: null }], piece.id)).toBeNull();
    expect(pairingFinishError([{ ...option, price_cents: -1 }], piece.id)).not.toBeNull();
    expect(pairingFinishError([{ ...option, price_cents: 1.5 }], piece.id)).not.toBeNull();
  });
  it("requires a preferred piece and unique finish names", () => {
    expect(pairingFinishError([option], null)).not.toBeNull();
    expect(pairingFinishError([option, { ...option, id: "two" }], piece.id)).not.toBeNull();
  });
  it("keeps overrides on their exact piece, never the fallback recommendation", () => {
    expect(selectCuratedPairings(primary, [piece], [], [rule])[0].finishOptions).toEqual([option]);
    expect(selectCuratedPairings(primary, [{ ...piece, id: "other" }], [], [rule])[0].finishOptions).toBeUndefined();
  });
  it("preserves catalogue defaults when no custom finish is configured", () => {
    expect(selectCuratedPairings(primary, [piece], [], [{ ...rule, finish_options: [] }])[0].finishOptions).toBeUndefined();
  });
  it("does not substitute catalogue price for missing, paused or unpriced options", () => {
    expect(resolvePairingFinish({ ...rule, enabled: false }, ref, piece.id)).toBeNull();
    expect(resolvePairingFinish(rule, { ...ref, optionId: "missing" }, piece.id)).toBeNull();
    expect(resolvePairingFinish(rule, ref, "other")).toBeNull();
    expect(resolvePairingFinish({ ...rule, finish_options: [{ ...option, price_cents: null }] }, ref, piece.id)).toBeNull();
    expect(parsePairingFinishOptions([{ ...option, price_cents: -5 }])).toEqual([]);
  });
  it("keeps different pairing selections separate and preserves the existing cart", async () => {
    vi.resetModules();
    const cart = await import("./cart");
    const item = { pickId: piece.id, title: piece.title, designerName: piece.brand, productSlug: "segment", designerSlug: "apparatus", finishLabel: option.name, imageUrl: null, leadTime: null, unitPriceCents: 240000, currency: "USD" };
    cart.addToCart({ ...item, quantity: 2 });
    cart.addToCart({ ...item, pairing: ref, quantity: 3 });
    expect(cart.getCart()).toHaveLength(2);
    expect(cart.getCart().map((l) => l.quantity)).toEqual([2, 3]);
    const basket = JSON.parse(localStorage.getItem("ma_secure_basket") || "{}");
    expect(basket.lines[1].pairing).toEqual(ref);
  });
});