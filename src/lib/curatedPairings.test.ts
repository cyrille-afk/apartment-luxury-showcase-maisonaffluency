import { describe, expect, it } from "vitest";
import { privatePairingsEnabled, selectCuratedPairings, type PairingProduct } from "./curatedPairings";

const product = (id: string, title: string): PairingProduct => ({ id, title, brand: "APPARATUS", image: "/test.jpg", path: `/products/${id}` });
const primary = product("tassel", "Tassel 57 Pendant");
const pool = [primary, product("pendant", "Another Pendant"), product("wall", "Cylinder Wall Sconce"), product("table", "Accent Side Table"), product("decor", "Bronze Bowl"), product("decor2", "Glass Vase")];
describe("curated cart pairing rules", () => {
  it("disables recommendations for Interior Designer / Architect", () => expect(privatePairingsEnabled("designer")).toBe(false));
  it("enables recommendations only for Private Client", () => { expect(privatePairingsEnabled("private")).toBe(true); expect(privatePairingsEnabled(null)).toBe(false); });
  it("pairs Tassel 57 with wall lighting, accent furniture and decor, never pendants", () => expect(selectCuratedPairings(primary, pool).map((p) => p.id)).toEqual(["wall", "table", "decor"]));
  it("limits the selection to three pieces", () => expect(selectCuratedPairings(primary, pool)).toHaveLength(3));
  it("omits pieces already in the basket", () => expect(selectCuratedPairings(primary, pool, ["wall"]).map((p) => p.id)).toEqual(["table", "decor"]));
  it("does not show a single uncurated fallback", () => expect(selectCuratedPairings(primary, [primary])).toEqual([]));
});