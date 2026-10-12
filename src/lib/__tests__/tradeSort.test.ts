import { describe, it, expect } from "vitest";
import { sortTradeProducts } from "@/lib/tradeSort";

const base = { image_url: null as string | null };

describe("sortTradeProducts", () => {
  it("designer sort orders by brand A–Z, then title within a brand", () => {
    const rows = [
      { brand_name: "Ecart - Jean-Michel Frank", product_name: "Chair", created_at: null, ...base },
      { brand_name: "Atelier Février", product_name: "Echo", created_at: null, ...base },
      { brand_name: "Atelier Février", product_name: "Ceramic", created_at: null, ...base },
    ];
    const sorted = sortTradeProducts(rows, "designer");
    expect(sorted.map((r) => r.product_name)).toEqual(["Ceramic", "Echo", "Chair"]);
  });

  it("title sort is accent-insensitive", () => {
    const rows = [
      { brand_name: "B", product_name: "Éclat Table", created_at: null, ...base },
      { brand_name: "A", product_name: "Aalto Sofa", created_at: null, ...base },
      { brand_name: "C", product_name: "Bench", created_at: null, ...base },
    ];
    const sorted = sortTradeProducts(rows, "title");
    expect(sorted.map((r) => r.product_name)).toEqual(["Aalto Sofa", "Bench", "Éclat Table"]);
  });

  it("recent sort puts the newest created_at first and timestamp-less rows last", () => {
    const rows = [
      { brand_name: "A", product_name: "No timestamp", created_at: null, ...base },
      { brand_name: "B", product_name: "Old", created_at: "2026-01-01T00:00:00Z", ...base },
      { brand_name: "C", product_name: "New", created_at: "2026-10-01T00:00:00Z", ...base },
    ];
    const sorted = sortTradeProducts(rows, "recent");
    expect(sorted.map((r) => r.product_name)).toEqual(["New", "Old", "No timestamp"]);
  });

  it("curated returns the input order untouched", () => {
    const rows = [
      { brand_name: "B", product_name: "Z", created_at: null, ...base },
      { brand_name: "A", product_name: "A", created_at: null, ...base },
    ];
    expect(sortTradeProducts(rows, "curated")).toEqual(rows);
  });
});
