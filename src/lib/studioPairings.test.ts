import { describe, expect, it } from "vitest";
import { rankStudioPairings, studioPairingTraits, type PairingProduct } from "./studioPairings";

const product = (id: string, name: string, materials = "dark stained wood, bronze"): PairingProduct => ({
  id, product_name: name, brand_name: "Maker", category: "Furniture", subcategory: null,
  materials, materials_description: null, default_variant_label: null, image_url: "image",
});
const chair = product("chair", "Frenchmen Street Lounge Chair");
describe("Studio reference pairings", () => {
  it("uses saved pale timber and bouclé without borrowing a default dark finish", () => {
    const selected = { ...chair, selected_finish: "Nude Oak / cream bouclé", default_variant_label: "Black Oak" };
    const traits = studioPairingTraits(selected);
    expect(traits.has("light timber")).toBe(true);
    expect(traits.has("bouclé")).toBe(true);
    expect(traits.has("dark timber")).toBe(false);
  });
  it("does not treat alternative variant finishes as the selected palette", () => {
    const traits = studioPairingTraits({ ...chair, materials: null, size_variants: [{ base: "Nude Oak", top: "Cream bouclé" }, { base: "Black Oak", top: "Blue leather" }] });
    expect(traits.has("oak")).toBe(true);
    expect(traits.has("light timber")).toBe(false);
    expect(traits.has("bouclé")).toBe(false);
    expect(traits.has("leather")).toBe(false);
  });
  it("returns a product ID only once, including catalogue mirrors", () => {
    const side = product("side", "Side Table");
    expect(rankStudioPairings(chair, [side, side, { ...side, id: "mirror", source_pick_id: "side" }], []).map(p => p.product_id)).toEqual(["side"]);
  });
  it("excludes the reference and all existing folder pieces and their source identities", () => {
    expect(rankStudioPairings(chair, [chair, product("saved", "Side Table"), { ...product("twin", "Coffee Table"), source_pick_id: "saved" }], ["saved"])).toEqual([]);
  });
  it("pairs lounge chairs with side/coffee tables, lighting and mirrors, never dining tables", () => {
    const result = rankStudioPairings(chair, [product("side", "Side Table"), product("coffee", "Coffee Table"), product("lamp", "Floor Lamp"), product("mirror", "Mirror"), product("dining", "Dining Table")], []);
    expect(result.map(p => p.product_id).sort()).toEqual(["coffee", "lamp", "mirror", "side"]);
  });
  it("ranks shared dark timber and bronze above unrelated materials with scores from 85 to 98", () => {
    const result = rankStudioPairings(chair, [product("unrelated", "Side Table", "glass"), product("matching", "Side Table")], []);
    expect(result[0].product_id).toBe("matching");
    expect(result[0].score).toBeGreaterThan(result[1].score);
    expect(result.every(p => p.score >= 85 && p.score <= 98)).toBe(true);
  });
  it("changes pairings when the reference category changes", () => {
    const candidates = [product("side", "Side Table"), product("bedside", "Bedside Table")];
    expect(rankStudioPairings(product("bed", "Bed"), candidates, []).map(p => p.product_id)).toEqual(["bedside"]);
    expect(rankStudioPairings(chair, candidates, []).map(p => p.product_id)).toEqual(["side"]);
  });
  it("scores invariant variant materials without assuming a selectable wood tone", () => {
    const reference = { ...chair, materials: null, size_variants: [{ base: "Nude Oak", top: "Cream Fabric" }, { base: "Black Pepper Oak", top: "Blue Fabric" }] };
    const result = rankStudioPairings(reference, [product("oak", "Side Table", "oak"), product("bronze", "Side Table", "bronze")], []);
    expect(result[0].product_id).toBe("oak");
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });
});