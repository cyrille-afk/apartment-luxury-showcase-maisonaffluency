import { describe, expect, it } from "vitest";
import { restoreSavedComparison } from "./comparatorDraft";

describe("saved comparison restoration", () => {
  const saved = { id: "dais", product_name: "Dais", brand_name: "Alexander Lamont", category: "Seating", image_url: "https://example.com/dais.jpg", materials: "Leather" };
  it("restores the saved name and selection order while refreshing available catalogue details", () => {
    const live = { ...saved, product_name: "Dais Lounge Chair", materials: "Bouclé", tags: [] };
    const draft = restoreSavedComparison([saved, { ...saved, id: "ondas", product_name: "Ondas" }], "Living room", [live]);
    expect(draft.shortlistName).toBe("Living room");
    expect(draft.compareList.map(p => p.id)).toEqual(["dais", "ondas"]);
    expect(draft.compareList[0].materials).toBe("Bouclé");
  });
  it("keeps saved pieces absent from loaded catalogue data without restoring cached prices", () => {
    const draft = restoreSavedComparison([{ ...saved, trade_price_cents: 5000 }], "Archive", []);
    expect(draft.compareList[0].product_name).toBe("Dais");
    expect(draft.compareList[0]).not.toHaveProperty("trade_price_cents");
  });
});