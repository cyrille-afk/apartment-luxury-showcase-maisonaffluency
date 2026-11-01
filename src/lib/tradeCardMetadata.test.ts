import { describe, expect, it } from "vitest";
import { tradeCardMetadata } from "./tradeCardMetadata";

describe("Trade card specification provenance", () => {
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
});