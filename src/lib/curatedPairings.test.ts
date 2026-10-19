import { describe, expect, it } from "vitest";
import { privatePairingsEnabled, selectCuratedPairings as select, type PairingProduct, type PairingRule } from "./curatedPairings";

const rules: PairingRule[] = ["wall", "tables", "decor"].map((target_category, sort_order) => ({ id: String(sort_order), source_category: "ceiling", target_category, preferred_pick_id: null, sort_order, enabled: true }));
const selectCuratedPairings = (primary: PairingProduct, pool: PairingProduct[], excluded: string[] = []) => select(primary, pool, excluded, rules);

const product = (id: string, title: string): PairingProduct => ({ id, title, brand: "APPARATUS", image: "/test.jpg", path: `/products/${id}` });
const primary = product("tassel", "Tassel 57 Pendant");
const pool = [primary, product("pendant", "Another Pendant"), product("wall", "Dining Table"), product("table", "Dining Sideboard"), product("decor", "Dining Room Rug"), product("decor2", "Hand-Woven Rug")];
describe("curated cart pairing rules", () => {
  it("disables recommendations for Interior Designer / Architect", () => expect(privatePairingsEnabled("designer")).toBe(false));
  it("enables recommendations only for Private Client", () => { expect(privatePairingsEnabled("private")).toBe(true); expect(privatePairingsEnabled(null)).toBe(false); });
  it("pairs ceiling lighting with dining furniture and a rug, never more pendants", () => expect(selectCuratedPairings(primary, pool).map((p) => p.id)).toEqual(["wall", "table", "decor"]));
  it("limits the selection to three pieces", () => expect(selectCuratedPairings(primary, pool)).toHaveLength(3));
  it("omits pieces already in the basket", () => expect(selectCuratedPairings(primary, pool, ["wall"]).map((p) => p.id)).toEqual(["table", "decor"]));
  it("does not show a single uncurated fallback", () => expect(selectCuratedPairings(primary, [primary])).toEqual([]));
  it("uses edited category order", () => expect(select(primary, pool, [], rules.map((r) => ({ ...r, sort_order: 2 - r.sort_order }))).map((p) => p.id)).toEqual(["decor", "table", "wall"]));
  it("uses an editor-selected published piece", () => expect(select(primary, pool, [], [{ ...rules[2], preferred_pick_id: "decor2" }]).map((p) => p.id)).toEqual(["decor2"]));
  it("omits paused matches", () => expect(select(primary, pool, [], rules.map((r) => ({ ...r, enabled: r.target_category !== "wall" }))).map((p) => p.id)).toEqual(["table", "decor"]));
  it("room slots override generic target categories without recommending a substitute", () => expect(select(primary, pool, [], [{ ...rules[0], target_category: "ceiling" }]).map(p => p.id)).toEqual(["wall"]));
  it("does not substitute a preferred piece from the wrong category", () => expect(select(primary, pool, [], [{ ...rules[0], preferred_pick_id: "pendant" }]).map((p) => p.id)).toEqual(["wall"]));
  it("deduplicates repeated target matches and caps results at three", () => expect(select(primary, pool, [], [...rules, { ...rules[2], id: "extra", preferred_pick_id: "decor2", sort_order: 3 }]).map((p) => p.id)).toEqual(["wall", "table", "decor"]));
  it("honors an empty editable catalog without hardcoded fallback", () => expect(select(primary, pool, [], [])).toEqual([]));
});
describe("pairings vary by first purchase", () => {
  it("different pendants of the same category don't all receive the same companions", () => {
    const other = (id: string, title: string): PairingProduct => ({ ...product(id, title), brand: "Other House" });
    const decor = Array.from({ length: 12 }, (_, i) => other(`rug${i}`, `Hand-Woven Rug ${i}`));
    const picks = new Set(Array.from({ length: 8 }, (_, i) => select(product(`p${i}`, `Pendant Light ${i}`), decor, [], rules)[0]?.id));
    expect(picks.size).toBeGreaterThan(1);
  });
});
describe("functional room-led pairings", () => {
  const chair = product("chair", "Rua Leblon Armchair");
  const coffee = product("coffee", "Praia da Granja Coffee Table");
  const living = [chair, coffee, product("side", "Madison Side Table"), product("floor", "Reading Floor Lamp"), product("rug", "Living Room Rug"),
    { ...product("tray", "Yugen Nbr 1"), category: "Décor", subcategory: "Trays & Change Trays" }, product("mirror", "Helios Mirror"),
    product("dining", "Dining Table"), product("office", "Office Chair"), product("outdoor", "Outdoor Armchair")];
  const roomRules = (source: string): PairingRule[] => ["tables", "table-light", "decor"].map((target_category, sort_order) => ({ id: String(sort_order), source_category: source, target_category, sort_order, enabled: true, preferred_pick_id: null }));
  it("armchairs get side table, floor lighting and rug, never a tray", () => {
    expect(select(chair, living, [], roomRules("seating")).map(p => p.id)).toEqual(["side", "floor", "rug"]);
  });
  it("coffee tables get living seating, floor lighting and rug, never a mirror", () => {
    expect(select(coffee, living, [], roomRules("tables")).map(p => p.id)).toEqual(["chair", "floor", "rug"]);
  });
  it("an incompatible preferred tray cannot bypass room relevance or attach its custom price", () => {
    const edited = roomRules("seating").map(r => ({ ...r, preferred_pick_id: "tray", finish_options: [{ id: "x", name: "Custom", price_cents: 999 }] }));
    const result = select(chair, living, [], edited);
    expect(result.map(p => p.id)).toEqual(["side", "floor", "rug"]);
    expect(result.every(p => p.pairingRuleId === undefined)).toBe(true);
  });
  it("selection changes replace the functional companions and basket additions exclude them", () => {
    expect(select(coffee, living, ["chair"], roomRules("tables")).map(p => p.id)).toEqual(["floor", "rug"]);
    expect(select(chair, living, ["side"], roomRules("seating")).map(p => p.id)).toEqual(["coffee", "floor", "rug"]);
  });
  it("never fills empty room slots with unrelated decor", () => {
    expect(select(chair, living.filter(p => ["tray", "mirror", "dining", "office", "outdoor"].includes(p.id)), [], roomRules("seating"))).toEqual([]);
  });
  it("room-led results are stable across catalogue ordering", () => {
    expect(select(chair, [...living].reverse(), [], roomRules("seating"))).toEqual(select(chair, living, [], roomRules("seating")));
  });
});
