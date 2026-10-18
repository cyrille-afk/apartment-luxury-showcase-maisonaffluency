import { describe, expect, it } from "vitest";
import { pairingFinishImage, pairingSwatchFor } from "./pairingFinishVisuals";

describe("pairing finish visual linking", () => {
  const rows = [{ base: "Lacquer", top: "Aged Brass" }, { base: "Lacquer", top: "Tarnished Silver" }];
  const images = ["hero.jpg", "brass.jpg", "silver.jpg"];
  it("switches to a dedicated complete combination photo", () => {
    expect(pairingFinishImage({ "lacquer|aged brass": 1 }, images, rows, { base: "Lacquer", top: "Aged Brass", label: null })).toBe("brass.jpg");
  });
  it("does not substitute another finish photo for a missing combination", () => {
    expect(pairingFinishImage({ "lacquer|aged brass": 1, "tarnished silver": 2 }, images, rows, { base: "Lacquer", top: "Tarnished Silver", label: null })).toBeUndefined();
  });
  it("retains the hero for an incomplete selection", () => {
    expect(pairingFinishImage({ "lacquer|aged brass": 1 }, images, rows, { base: "Lacquer", top: null, label: null })).toBeUndefined();
  });
  it("uses explicit custom finish mapping without guessing", () => {
    expect(pairingFinishImage({ "aged brass": 1 }, images, [], { base: null, top: null, label: null }, "Aged Brass")).toBe("brass.jpg");
  });
  it("rejects out-of-bounds imagery", () => {
    expect(pairingFinishImage({ "lacquer|aged brass": 7 }, images, rows, { base: "Lacquer", top: "Aged Brass", label: null })).toBeUndefined();
  });
  it("resolves authentic swatches accent-insensitively and avoids ambiguous suffixes", () => {
    expect(pairingSwatchFor("Ecru", [{ name: "Écru", image_url: "ecru.jpg" }])?.image_url).toBe("ecru.jpg");
    expect(pairingSwatchFor("Brass", [{ name: "Aged Brass", image_url: "aged.jpg" }, { name: "Weathered Brass", image_url: "weathered.jpg" }])).toBeUndefined();
  });
});