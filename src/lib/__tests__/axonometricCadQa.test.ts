import { describe, it, expect } from "vitest";
import { parseDimText, formatCadDim, computeCadQa } from "@/lib/axonometricCadQa";

describe("axonometric CAD QA helpers", () => {
  describe("parseDimText", () => {
    it("parses cm triplets", () => {
      expect(parseDimText("W65 × D58 × H79 cm")).toEqual({ w: 65, d: 58, h: 79 });
    });
    it("parses CAD-annotated strings", () => {
      expect(parseDimText("W120 × D60 × H75 cm (from CAD)")).toEqual({ w: 120, d: 60, h: 75 });
    });
    it("converts mm-only strings to cm", () => {
      expect(parseDimText("W650 × D580 × H790 mm")).toEqual({ w: 65, d: 58, h: 79 });
    });
    it("returns null when nothing matches", () => {
      expect(parseDimText(null)).toBeNull();
      expect(parseDimText("a large round table")).toBeNull();
    });
  });

  describe("formatCadDim", () => {
    it("rounds mm to cm and labels source", () => {
      expect(formatCadDim({ w: 1204, d: 602, h: 751 })).toEqual({
        text: "W120 × D60 × H75 cm (from CAD)",
        cm: { w: 120, d: 60, h: 75 },
      });
    });
    it("omits height when zero", () => {
      expect(formatCadDim({ w: 1000, d: 500, h: 0 })?.text).toBe("W100 × D50 cm (from CAD)");
    });
    it("returns null without W or D", () => {
      expect(formatCadDim({ w: 0, d: 500 })).toBeNull();
    });
  });

  describe("computeCadQa", () => {
    const ready = { bbox_mm: { w: 1200, d: 600, h: 750 }, status: "ready" };

    it("flags no_cad when no geometry row exists", () => {
      expect(
        computeCadQa({ originalDimText: "W120 × D60 × H75 cm", appliedDimText: "W120 × D60 × H75 cm", cadGeometry: null }).status,
      ).toBe("no_cad");
    });

    it("flags cad_unparsed when status is not ready", () => {
      expect(
        computeCadQa({
          originalDimText: null,
          appliedDimText: null,
          cadGeometry: { bbox_mm: null, status: "pending" },
        }).status,
      ).toBe("cad_unparsed");
    });

    it("returns match when applied dims equal CAD within tolerance", () => {
      const r = computeCadQa({
        originalDimText: "W120 × D60 × H75 cm",
        appliedDimText: "W120 × D60 × H75 cm (from CAD)",
        cadGeometry: ready,
      });
      expect(r.status).toBe("match");
      expect(r.expected_dim_text).toBe("W120 × D60 × H75 cm (from CAD)");
      expect(r.delta_cm).toEqual({ w: 0, d: 0, h: 0 });
    });

    it("flags mismatch when applied dims drift beyond tolerance", () => {
      const r = computeCadQa({
        originalDimText: "W90 × D60 × H75 cm",
        appliedDimText: "W90 × D60 × H75 cm", // override did not happen
        cadGeometry: ready,
      });
      expect(r.status).toBe("mismatch");
      expect(r.delta_cm?.w).toBe(-30);
    });

    it("flags mismatch when no applied dims at all but CAD exists", () => {
      const r = computeCadQa({
        originalDimText: null,
        appliedDimText: null,
        cadGeometry: ready,
      });
      expect(r.status).toBe("mismatch");
    });

    it("respects custom tolerance", () => {
      const r = computeCadQa({
        originalDimText: "W122 × D60 × H75 cm",
        appliedDimText: "W122 × D60 × H75 cm",
        cadGeometry: ready,
        toleranceCm: 3,
      });
      expect(r.status).toBe("match");
    });
  });
});
