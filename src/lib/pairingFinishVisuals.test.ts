import { describe, expect, it } from "vitest";
import { pairingFinishImage, pairingSwatchFor, pairingVisualOptions } from "./pairingFinishVisuals";

describe("pairing finish visual linking", () => {
  it("matches all nine Portal table options to their product-page samples without changing priced values", () => {
    const options = ["Nero Kinatra Marble", "Blackened Ash Wood", "Bleached Ash Wood", "Nero Portoro Marble", "Lumachella Marble", "Silk Georgette Marble", "Bianco Arabescato Marble", "Navona Travertine", "Silver Travertine"];
    const names = ["Marble - Nero Kinitra", "Ash Wood - Blackened", "Ash Wood - Bleached", "Marble - Nero Portoro", "Marble - Lumachella", "Marble - Silk Georgette", "Marble - Bianco Arabescato", "Travertine - Navona", "Travertine - Silver"];
    const swatches = names.map((name, index) => ({ name, image_url: `sample-${index}.jpg` }));
    expect(options.map(option => pairingSwatchFor(option, swatches)?.image_url)).toEqual(names.map((_, index) => `sample-${index}.jpg`));
    expect(pairingVisualOptions(options, swatches)).toEqual(options.map((value, index) => ({ value, name: names[index] })));
  });
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
  it("requires the exact selected colour photo rather than a generic family photo", () => {
    const selection = { base: "Lacquer", top: "Aged Brass", label: null };
    const visual = { ...selection, base: "Lacquer - Ivory" };
    expect(pairingFinishImage({ "lacquer - ivory|aged brass": 1 }, images, rows, selection, undefined, visual)).toBe("brass.jpg");
    expect(pairingFinishImage({ "lacquer|aged brass": 1 }, images, rows, selection, undefined, visual)).toBeUndefined();
  });
  it("resolves authentic swatches accent-insensitively and avoids ambiguous suffixes", () => {
    expect(pairingSwatchFor("Ecru", [{ name: "Écru", image_url: "ecru.jpg" }])?.image_url).toBe("ecru.jpg");
    expect(pairingSwatchFor("Brass", [{ name: "Aged Brass", image_url: "aged.jpg" }, { name: "Weathered Brass", image_url: "weathered.jpg" }])).toBeUndefined();
  });
  it("resolves bracketed material treatments without changing the priced axis", () => {
    expect(pairingSwatchFor("Aged Brass", [{ name: "Aged Brass [Waxed]", image_url: "brass.jpg" }])?.image_url).toBe("brass.jpg");
    expect(pairingVisualOptions(["Lacquer"], [{ name: "Lacquer - Ivory", image_url: "ivory.jpg" }, { name: "Lacquer - Gray", image_url: "gray.jpg" }])).toEqual([{ value: "Lacquer", name: "Lacquer - Ivory" }, { value: "Lacquer", name: "Lacquer - Gray" }]);
  });
});
describe("category families", () => {
  it("expands fabric/leather categories into their swatches, tolerating a one-letter spelling slip", async () => {
    const { pairingVisualOptions } = await import("./pairingFinishVisuals");
    const sw = ["Safire-2 0006", "Safire-2 0007", "Opera Calla", "Cervo 2150 Black"].map((name) => ({ name, image_url: "x" }));
    expect(pairingVisualOptions(["Fabric Cat. Safire 2"], sw).map((o) => o.name)).toEqual(["Safire-2 0006", "Safire-2 0007"]);
    expect(pairingVisualOptions(["Leather Cat. Servo"], sw).map((o) => o.name)).toEqual(["Cervo 2150 Black"]);
  });
});
