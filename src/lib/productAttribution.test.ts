import { describe, expect, it } from "vitest";
import { productAttribution } from "./productAttribution";

describe("consistent product attribution", () => {
  it("separates Madison's designer from its title and publisher", () => {
    expect(productAttribution({ title: "Madison Avenue Side Table by Yabu Pushelberg", brandName: "Man of Parts", edition: "Man of Parts Edition" })).toMatchObject({ title: "Madison Avenue Side Table", designer: "Yabu Pushelberg", house: "Man of Parts", edition: "Man of Parts Edition", houseLine: null });
  });
  it("keeps Frenchmen's designer independent of its trade brand", () => {
    expect(productAttribution({ title: "Frenchmen Street Lounge Chair ", designerName: "Sebastian Herkner", brandName: "Man of Parts", houseName: "Man of Parts", edition: "Man of Parts Edition" })).toMatchObject({ title: "Frenchmen Street Lounge Chair", designer: "Sebastian Herkner", house: "Man of Parts", edition: "Man of Parts Edition" });
  });
  it("identifies a recorded publishing house without inventing a numbered edition", () => {
    expect(productAttribution({ title: "Table", designerName: "Maker", houseName: "Publisher" })).toMatchObject({ edition: "Publisher Edition", houseLine: null });
  });
  it("does not promote a finish subtitle to designer", () => {
    expect(productAttribution({ title: "Table", subtitle: "Clear", brandName: "Atelier" })).toMatchObject({ designer: "Atelier", subtitle: "Clear" });
  });
  it("preserves numbered and signed editions", () => {
    expect(productAttribution({ title: "Table", edition_number: "1/8", edition_signing: "Signed" }).edition).toBe("Edition 1/8 — Signed");
  });
  it("retains the singular Ecart badge", () => {
    expect(productAttribution({ title: "Table", designerName: "Jean-Michel Frank", houseName: "Ecart", edition: "REEDITION" }).edition).toBe("REEDITION");
  });
  it("old shares retain unknown credits without inventing a person", () => {
    expect(productAttribution({ title: "Table" })).toMatchObject({ title: "Table", designer: null, house: null, edition: null });
  });
});