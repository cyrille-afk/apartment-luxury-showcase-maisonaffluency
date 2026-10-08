import { describe, it, expect } from "vitest";
import { buildFurnishingSchedulePdf, scheduleTotalEur } from "@/lib/furnishingSchedulePdf";

const rows = [
  { name: "Sandy Cove Sofa", manufacturer: "Man of Parts", priceEur: 8270, dimensions: null, productUrl: "https://www.maisonaffluency.com/designers/man-of-parts/sandy-cove-sofa" },
  { name: "Praia da Granja Coffee Table", manufacturer: "Man of Parts", priceEur: 8499, dimensions: "D 90 × H 35 cm", productUrl: null },
];

describe("furnishing schedule pdf", () => {
  it("embeds clickable product links and marks client-ready copies", async () => {
    const blob = buildFurnishingSchedulePdf(rows, "Curated Room Layout", { clientReady: true });
    const text = await blob.text();
    expect(text).toContain("/URI (https://www.maisonaffluency.com/designers/man-of-parts/sandy-cove-sofa)");
    expect(text).not.toContain("/trade/products");
    expect(scheduleTotalEur(rows)).toBe(16769);
  });
  it("omits link annotations when no url is given", async () => {
    const blob = buildFurnishingSchedulePdf([rows[1]], "T");
    const text = await blob.text();
    expect(text).not.toContain("/URI");
  });
});
