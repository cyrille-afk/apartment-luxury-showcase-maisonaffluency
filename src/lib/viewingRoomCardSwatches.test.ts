import { describe, it, expect } from "vitest";
import { viewingRoomCardSwatches, type ViewingRoomChoice, type ViewingRoomItem } from "./viewingRoom";

const swatch = (id: string, name: string, category = "Wood", image_url: string | null = `https://example.com/${id}.jpg`) => ({
  id, name, category, brand_name: "Maker", image_url, material_type: category, color_family: null,
});

const baseItem: ViewingRoomItem = {
  id: "11111111-1111-4111-8111-111111111111", product_name: "Rua Leblon", category: "Seating", subcategory: null,
  image_url: null, dimensions: null, width_mm: null, depth_mm: null, height_mm: null, glb_url: null, lead_time: "12 weeks",
  materials: { "default-a": swatch("def-a", "Aged Brass", "Metal"), "default-b": swatch("def-b", "Anthracite Oak") },
};

const baseChoice: ViewingRoomChoice = {
  ...baseItem, materials: {}, retail_price: 4925, retail_price_from: false, size_options: [], finish_options: [],
};

describe("viewingRoomCardSwatches", () => {
  it("keeps curated finish-option swatches visible after personalization strips default-* keys", () => {
    const piece: ViewingRoomChoice = {
      ...baseChoice,
      finish_options: [{
        key: "1", label: "Opera / Natural Walnut", retail_price: 4925, image_url: null, lead_time: null,
        materials: { base: swatch("walnut", "Natural Walnut") },
        colourways: [swatch("op-1", "Opera Beige", "Fabric"), swatch("op-2", "Opera Calla", "Fabric")],
        axes: [],
      }],
    };
    expect(viewingRoomCardSwatches(piece, baseItem).map(s => s.id)).toEqual(["walnut", "op-1", "op-2"]);
  });

  it("retains same-piece fallback swatches when no finish options exist", () => {
    expect(viewingRoomCardSwatches(baseChoice, baseItem).map(s => s.id)).toEqual(["def-a", "def-b"]);
  });

  it("never leaks original slot fallback swatches onto a swapped alternative", () => {
    const swapped: ViewingRoomChoice = { ...baseChoice, id: "22222222-2222-4222-8222-222222222222", product_name: "Other Table" };
    expect(viewingRoomCardSwatches(swapped, baseItem)).toEqual([]);
  });

  it("shows only the buyer's chosen finishes once customized", () => {
    const customized: ViewingRoomChoice = {
      ...baseChoice, finish_key: "1",
      materials: { upholstery: swatch("op-2", "Opera Calla", "Fabric") },
      finish_options: [{
        key: "1", label: "Opera", retail_price: 5100, image_url: null, lead_time: null,
        materials: { upholstery: swatch("op-1", "Opera Beige", "Fabric") },
        colourways: [swatch("op-1", "Opera Beige", "Fabric"), swatch("op-2", "Opera Calla", "Fabric")],
        axes: [],
      }],
    };
    expect(viewingRoomCardSwatches(customized, baseItem).map(s => s.id)).toEqual(["op-2"]);
  });
});