import { describe, expect, it } from "vitest";
import { tradeCardMetadata, suppressTradeCardBrand } from "./tradeCardMetadata";

describe("Trade card specification provenance", () => {
  it('suppresses Michel Amar Studio when that studio is filtered or searched', () => {
    expect(suppressTradeCardBrand('Michel Amar Studio', 'Michel Amar Studio', '')).toBe(true);
    expect(suppressTradeCardBrand('Michel Amar Studio', null, 'michel amar studio')).toBe(true);
    expect(suppressTradeCardBrand('Michel Amar Studio', null, 'chair')).toBe(false);
  });
  it('preserves different maker and collaboration credits in a studio filter', () => {
    expect(suppressTradeCardBrand('Emma Donnersberg', 'Michel Amar Studio', '')).toBe(false);
    expect(suppressTradeCardBrand('Michel Amar × Emma Donnersberg', 'Michel Amar Studio', '')).toBe(false);
    expect(suppressTradeCardBrand('Michel Amar Studio', null, '')).toBe(false);
  });
  it("uses each piece's recorded lead time, not a universal 12 weeks", () => {
    expect(tradeCardMetadata({ lead_time: "20-22 week" }).leadTime).toBe("20-22 week");
    expect(tradeCardMetadata({ lead_time: "12 -14 weeks" }).leadTime).toBe("12 -14 weeks");
    expect(tradeCardMetadata({ lead_time: null }).leadTime).toBeNull();
    expect(tradeCardMetadata({ lead_time: " " }).leadTime).toBeNull();
  });

  it("preserves recorded dimensions and never invents H 73cm x W 252cm", () => {
    expect(tradeCardMetadata({ dimensions: "Ø 80 cm" }).dimensions).toBe("Ø 80 cm");
    expect(tradeCardMetadata({}).dimensions).toBeNull();
    expect(tradeCardMetadata({ dimensions: " " }).dimensions).toBeNull();
  });

  it("falls back to the recorded size-variant labels when the dimensions field is empty", () => {
    // Finish variants repeat the same size; show it once.
    expect(
      tradeCardMetadata({
        size_variants: [
          { label: "L 252 x H 73 x W150 cm" },
          { label: "L 252 x H 73 x W150 cm" },
        ],
      }).dimensions,
    ).toBe("L 252 x H 73 x W150 cm");
    // Distinct sizes: first size plus a count, never a fabricated value.
    expect(
      tradeCardMetadata({
        size_variants: [{ label: "D 100 x H 54 cm" }, { label: "L140 x W65 x H12 cm" }],
      }).dimensions,
    ).toBe("D 100 x H 54 cm · 2 sizes");
    expect(tradeCardMetadata({ size_variants: [{ label: " " }, {}] }).dimensions).toBeNull();
    // An explicit dimensions field still wins over variant labels.
    expect(
      tradeCardMetadata({ dimensions: "Ø 80 cm", size_variants: [{ label: "L 1 cm" }] }).dimensions,
    ).toBe("Ø 80 cm");
  });
});