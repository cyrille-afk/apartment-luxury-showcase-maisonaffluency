import { describe, expect, it } from "vitest";
import { privatePairingsEnabled, selectCuratedPairings as select, type PairingProduct, type PairingRule } from "./curatedPairings";

const rules: PairingRule[] = ["wall", "tables", "decor"].map((target_category, sort_order) => ({ id: String(sort_order), source_category: "ceiling", target_category, preferred_pick_id: null, sort_order, enabled: true }));
const selectCuratedPairings = (primary: PairingProduct, pool: PairingProduct[], excluded: string[] = []) => select(primary, pool, excluded, rules);

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
  it("uses edited category order", () => expect(select(primary, pool, [], rules.map((r) => ({ ...r, sort_order: 2 - r.sort_order }))).map((p) => p.id)).toEqual(["decor", "table", "wall"]));
  it("uses an editor-selected published piece", () => expect(select(primary, pool, [], [{ ...rules[2], preferred_pick_id: "decor2" }]).map((p) => p.id)).toEqual(["decor2"]));
  it("omits paused matches", () => expect(select(primary, pool, [], rules.map((r) => ({ ...r, enabled: r.target_category !== "wall" }))).map((p) => p.id)).toEqual(["table", "decor"]));
  it("rejects same-category matches even if supplied", () => expect(select(primary, pool, [], [{ ...rules[0], target_category: "ceiling" }])).toEqual([]));
  it("does not substitute a preferred piece from the wrong category", () => expect(select(primary, pool, [], [{ ...rules[0], preferred_pick_id: "pendant" }]).map((p) => p.id)).toEqual(["wall"]));
  it("deduplicates repeated target matches and caps results at three", () => expect(select(primary, pool, [], [...rules, { ...rules[2], id: "extra", preferred_pick_id: "decor2", sort_order: 3 }]).map((p) => p.id)).toEqual(["wall", "table", "decor"]));
  it("honors an empty editable catalog without hardcoded fallback", () => expect(select(primary, pool, [], [])).toEqual([]));
});