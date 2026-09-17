import { describe, it, expect } from "vitest";
import { validateFelixLogic, cityNameSimilarity } from "@/lib/validateFelixLogic";
const ship = "Thank you. Marrakech falls outside our standard concierge trade routes. The nearest primary hub is London.";
describe("validateFelixLogic", () => {
  it("discards shipping answers to room replies", () => {
    const v = validateFelixLogic(ship, "Living and Dining room");
    expect(v.ok).toBe(false);
    expect(v.response).toBe("Understood. Let's catalog your design ideas for the Living and Dining Room zone.");
  });
  it("keeps shipping answers to real cities", () => {
    expect(validateFelixLogic(ship, "Actually the project is in Marrakech").ok).toBe(true);
    expect(validateFelixLogic(ship, "Singapore").ok).toBe(true);
  });
  it("keeps non-shipping replies", () => {
    expect(validateFelixLogic("Understood. Prioritizing the Living and Dining layouts.", "Living and Dining room").ok).toBe(true);
  });
  it("similarity", () => {
    expect(cityNameSimilarity("Londn")).toBeGreaterThan(0.5);
    expect(cityNameSimilarity("dressing room")).toBeLessThan(0.5);
  });
});
