import { describe, expect, it } from "vitest";
import { updateFelixProductSelection } from "./updateFelixProductSelection";

const ava = { productId: "cloud-stratus", productName: "Cloud Stratus", topLabel: "AVA Range", tradePriceLabel: "€4,815" };
const com = { ...ava, topLabel: "COM", tradePriceLabel: "€4,500" };
describe("Felix product selection updates", () => {
  it("replaces AVA and its price with COM on the existing card", () => {
    const result = updateFelixProductSelection([{ kind: "proactive_tearsheet", data: ava }], com);
    expect(result).toEqual([{ kind: "proactive_tearsheet", data: com }]);
  });
  it("never inserts a card before Co-pilot addition", () => {
    expect(updateFelixProductSelection([], com)).toEqual([]);
  });
  it("leaves other products and committed cards unchanged", () => {
    const timeline = [{ kind: "proactive_tearsheet", data: { ...ava, productId: "other" } }, { kind: "proactive_tearsheet", data: ava, resolved: "generated" }];
    const result = updateFelixProductSelection(timeline, com);
    expect(result[0]).toBe(timeline[0]);
    expect(result[1]).toBe(timeline[1]);
  });
});