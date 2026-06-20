import { describe, it, expect } from "vitest";
import {
  isFinishAxisLabel,
  swatchCoversOption,
  shouldSuppressSingleAsFinish,
  shouldSuppressBaseAsFinish,
  shouldSuppressTopAsFinish,
} from "../finishDuplication";

/**
 * UI regression guard: when the swatch picker already exposes every
 * finish/material option, the parallel text dropdown must NOT render —
 * otherwise the user sees two "Select Your Finish" dropdowns side by side
 * (the Angelo M × Alinea marble palette bug).
 */
describe("finish dropdown de-duplication", () => {
  describe("isFinishAxisLabel", () => {
    it.each(["Frame", "Wood", "Finish", "Feet", "Leg", "Base", "Legs"])(
      "%s is a finish axis",
      (label) => expect(isFinishAxisLabel(label)).toBe(true),
    );

    it.each(["Size", "Dimensions", "Height", "Color"])(
      "%s is NOT a finish axis",
      (label) => expect(isFinishAxisLabel(label)).toBe(false),
    );
  });

  describe("swatchCoversOption", () => {
    it("matches exact label", () => {
      expect(swatchCoversOption("Kynos", "Kynos")).toBe(true);
    });
    it("matches case-insensitively and trims whitespace", () => {
      expect(swatchCoversOption("  KYNOS ", "kynos")).toBe(true);
    });
    it("matches substring either direction", () => {
      expect(swatchCoversOption("Bianco Statuarietto", "Bianco")).toBe(true);
      expect(swatchCoversOption("Bianco", "Bianco Statuarietto")).toBe(true);
    });
    it("rejects unrelated labels", () => {
      expect(swatchCoversOption("Kynos", "Grafite")).toBe(false);
    });
    it("rejects empty strings", () => {
      expect(swatchCoversOption("", "Kynos")).toBe(false);
      expect(swatchCoversOption("Kynos", "")).toBe(false);
    });
  });

  describe("shouldSuppressSingleAsFinish (regression for Angelo M)", () => {
    const ALINEA_MARBLES = [
      "Kynos",
      "Grafite",
      "Travertino Rosso",
      "Grey Saint Laurent",
      "Picasso Green",
      "Port Saint Laurent",
      "Travertino Silver",
      "Rosso Lepanto",
      "Bianco Statuarietto",
      "Ceppo di Sicilia",
    ];

    it("suppresses dropdown when every marble option has a swatch", () => {
      expect(
        shouldSuppressSingleAsFinish({
          hasSingleAxisSplit: true,
          singleMaterialOptions: ["Kynos", "Grafite", "Bianco Statuarietto"],
          linkedWoodFinishes: ALINEA_MARBLES,
        }),
      ).toBe(true);
    });

    it("still suppresses when one option has a typo (Kynos vs library Kyknos)", () => {
      // Real Angelo M/R × Alinea bug: variant labels use "Kynos" but the
      // designer swatch library is spelled "Kyknos". The dropdown still
      // duplicates the swatch picker — suppress as long as the rest overlap.
      expect(
        shouldSuppressSingleAsFinish({
          hasSingleAxisSplit: true,
          singleMaterialOptions: [
            "Kynos",
            "Grafite",
            "Travertino Rosso / Grey Saint Laurent / Picasso Green",
            "Port Saint Laurent / Travertino Silver / Rosso Lepanto",
            "Bianco Statuarietto",
          ],
          linkedWoodFinishes: [
            "Bianco Statuarietto",
            "Ceppo di Sicilia",
            "Grafite",
            "Grey Saint Laurent",
            "Kyknos",
            "Picasso Green",
            "Port Saint Laurent",
            "Rosso Lepanto",
            "Travertino Rosso",
            "Travertino Silver",
          ],
        }),
      ).toBe(true);
    });

    it("keeps dropdown when NO option overlaps with any swatch", () => {
      expect(
        shouldSuppressSingleAsFinish({
          hasSingleAxisSplit: true,
          singleMaterialOptions: ["Unobtanium", "Mithril"],
          linkedWoodFinishes: ALINEA_MARBLES,
        }),
      ).toBe(false);
    });


    it("keeps dropdown when no swatches are linked", () => {
      expect(
        shouldSuppressSingleAsFinish({
          hasSingleAxisSplit: true,
          singleMaterialOptions: ["Kynos"],
          linkedWoodFinishes: [],
        }),
      ).toBe(false);
    });

    it("does nothing when the product has no single-axis split", () => {
      expect(
        shouldSuppressSingleAsFinish({
          hasSingleAxisSplit: false,
          singleMaterialOptions: ["Kynos"],
          linkedWoodFinishes: ALINEA_MARBLES,
        }),
      ).toBe(false);
    });

    it("does nothing when there are no material options", () => {
      expect(
        shouldSuppressSingleAsFinish({
          hasSingleAxisSplit: true,
          singleMaterialOptions: [],
          linkedWoodFinishes: ALINEA_MARBLES,
        }),
      ).toBe(false);
    });
  });

  describe("normalization layer (Kynos ↔ Kyknos typo)", () => {

    // Library spelling is "Kyknos"; variant spelling is "Kynos". The
    // normalization layer must treat them as the same finish for both
    // suppression and coverage helpers — otherwise the strict `every`
    // path would leak the duplicate dropdown back into the UI.
    const lib = [
      "Bianco Statuarietto",
      "Grafite",
      "Kyknos",
      "Picasso Green",
      "Travertino Rosso",
    ];

    it("everyOptionCoveredBySwatches accepts Kynos via fuzzy match", () => {
      expect(
        everyOptionCoveredBySwatches(["Kynos", "Grafite", "Bianco"], lib),
      ).toBe(true);
    });

    it("everyOptionCoveredBySwatches still rejects truly unrelated options", () => {
      expect(
        everyOptionCoveredBySwatches(["Kynos", "Mithril"], lib),
      ).toBe(false);
    });

    it("someOptionCoveredBySwatches matches via fuzzy normalization", () => {
      expect(someOptionCoveredBySwatches(["Mithril", "Kynos"], lib)).toBe(true);
      expect(someOptionCoveredBySwatches(["Mithril", "Unobtanium"], lib)).toBe(false);
    });
  });


  describe("shouldSuppressBaseAsFinish", () => {
    const base = {
      baseAxisIsDim: false,
      topAxisIsDim: true,
      baseAxisLabelRaw: "Frame",
      topAxisLabelRaw: "Size",
      baseOptions: ["Walnut", "Oak"],
      topOptions: ["130", "160"],
      linkedWoodFinishes: ["Walnut", "Oak", "Ash"],
      isUpholstered: false,
    };

    it("suppresses when every base option is covered by a swatch", () => {
      expect(shouldSuppressBaseAsFinish(base)).toBe(true);
    });

    it("suppresses on finish-axis label even if not all options covered, when swatches exist", () => {
      expect(
        shouldSuppressBaseAsFinish({
          ...base,
          baseOptions: ["Walnut", "Custom"],
        }),
      ).toBe(true);
    });

    it("does not suppress dimension axes", () => {
      expect(
        shouldSuppressBaseAsFinish({ ...base, baseAxisIsDim: true }),
      ).toBe(false);
    });
  });

  describe("shouldSuppressTopAsFinish", () => {
    const top = {
      baseAxisIsDim: true,
      topAxisIsDim: false,
      baseAxisLabelRaw: "Size",
      topAxisLabelRaw: "Frame",
      baseOptions: ["130", "160"],
      topOptions: ["Walnut", "Oak"],
      linkedWoodFinishes: ["Walnut"],
      isUpholstered: true,
    };

    it("suppresses when any top option is covered by a swatch", () => {
      expect(shouldSuppressTopAsFinish(top)).toBe(true);
    });

    it("suppresses for upholstered product with finish-axis label even without swatch overlap", () => {
      expect(
        shouldSuppressTopAsFinish({
          ...top,
          topOptions: ["Bespoke"],
          linkedWoodFinishes: [],
        }),
      ).toBe(true);
    });

    it("does not suppress for non-upholstered + no swatch overlap", () => {
      expect(
        shouldSuppressTopAsFinish({
          ...top,
          isUpholstered: false,
          topOptions: ["Bespoke"],
          linkedWoodFinishes: [],
        }),
      ).toBe(false);
    });
  });
});
