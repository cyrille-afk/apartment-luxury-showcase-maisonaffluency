import { describe, expect, it } from "vitest";
import { updateFelixProductSelection } from "./updateFelixProductSelection";

const ava = { productId: "cloud-stratus", productName: "Cloud Stratus", topLabel: "AVA Range", tradePriceLabel: "€4,815" };
const com = { ...ava, topLabel: "COM", tradePriceLabel: "€4,500" };
describe("Felix product selection updates", () => {
  it("replaces AVA and its price with COM on the existing card", () => {
    const result = updateFelixProductSelection([{ kind: "proactive_tearsheet", data: ava }], com);
    expect(result).toEqual([{ kind: "proactive_tearsheet", data: { ...com, quantity: 1 } }]);
  });
  it("never inserts a card before Co-pilot addition", () => {
    expect(updateFelixProductSelection([], com)).toEqual([]);
  });
  it("keeps the card quantity when a finish and its unit price change", () => {
    const result = updateFelixProductSelection([{ kind: "proactive_tearsheet", data: { ...ava, quantity: 3 } }], { ...com, unitPriceCents: 450000 });
    expect(result[0].data).toMatchObject({ quantity: 3, topLabel: "COM", unitPriceCents: 450000 });
  });
  it("leaves other products and committed cards unchanged", () => {
    const timeline = [{ kind: "proactive_tearsheet", data: { ...ava, productId: "other" } }, { kind: "proactive_tearsheet", data: ava, resolved: "generated" }];
    const result = updateFelixProductSelection(timeline, com);
    expect(result[0]).toBe(timeline[0]);
    expect(result[1]).toBe(timeline[1]);
  });
  it("keeps the locked photo when the page photo changes", () => {
    const locked = { ...ava, imageUrl: "photo-2.jpg", savedImageField: "photo-2.jpg" };
    const result = updateFelixProductSelection([{ kind: "proactive_tearsheet", data: locked }], { ...ava, imageUrl: "tobacco.jpg", savedImageField: "tobacco.jpg" });
    expect(result[0].data).toMatchObject({ imageUrl: "photo-2.jpg", savedImageField: "photo-2.jpg" });
  });
});