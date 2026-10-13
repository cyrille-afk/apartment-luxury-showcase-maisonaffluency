import { describe, expect, it } from "vitest";
import { DEFAULT_MODELS_ONLY, filterVisualiserCatalog, has3dAsset, visualiserCatalogFacets, type VisualiserCatalogItem } from "@/lib/visualiserCatalog";

const chair: VisualiserCatalogItem = { id: "chair", product_name: "Frenchmen Armchair", brand_name: "Man of Parts", category: "Seating", subcategory: "Armchairs", glb_url: "https://assets.example/chair.glb", image_url: "https://assets.example/chair.jpg" };
const sofa = { ...chair, id: "sofa", product_name: "Sofa", subcategory: "Sofas" };
const table = { ...chair, id: "table", product_name: "Side Table", category: "Tables", subcategory: "Side Tables", brand_name: "Other" };
const lamp = { ...chair, id: "lamp", product_name: "Lamp", category: "Lighting", subcategory: "Table Lights", glb_url: null };
const items = [chair, sofa, table, lamp];

describe("Visualiser catalog rules", () => {
  it("defaults to 3D-only and excludes 2D-only products", () => {
    expect(DEFAULT_MODELS_ONLY).toBe(true);
    expect(filterVisualiserCatalog(items).map(item => item.id)).toEqual(["chair", "sofa", "table"]);
    expect(filterVisualiserCatalog(items, { modelsOnly: false })).toHaveLength(4);
  });
  it.each(["glb", "gltf", "obj"])("accepts associated .%s geometry including signed URLs", extension => {
    expect(has3dAsset({ glb_url: `https://assets.example/model.${extension.toUpperCase()}?token=test` })).toBe(true);
  });
  it.each([null, "", "https://assets.example/lamp.jpg", "https://assets.example/model.glb.jpg", "https://assets.example/photo.png?file=model.glb", "javascript:model.glb"])("rejects non-geometry associations: %s", glb_url => {
    expect(has3dAsset({ glb_url })).toBe(false);
  });
  it("combines designer, category, subcategory and search", () => {
    expect(filterVisualiserCatalog(items, { designer: "Man of Parts", category: "Seating", subcategory: "Armchairs", search: "Frenchmen" }).map(item => item.id)).toEqual(["chair"]);
    expect(filterVisualiserCatalog(items, { designer: "Other", category: "Seating" })).toEqual([]);
  });
  it("counts categories within designer and asset filters", () => {
    const facets = visualiserCatalogFacets(items, { designer: "Man of Parts" });
    expect(facets.categories.find(item => item.label === "Seating")?.count).toBe(2);
    expect(facets.categories.find(item => item.label === "Lighting")?.count).toBe(0);
    expect(visualiserCatalogFacets(items, { designer: "Man of Parts", modelsOnly: false }).categories.find(item => item.label === "Lighting")?.count).toBe(1);
  });
  it("counts subcategories under the chosen category without self-filtering", () => {
    const facets = visualiserCatalogFacets(items, { category: "Seating", subcategory: "Armchairs" });
    expect(facets.subcategories.find(item => item.label === "Armchairs")?.count).toBe(1);
    expect(facets.subcategories.find(item => item.label === "Sofas")?.count).toBe(1);
    expect(facets.subcategories.some(item => item.label === "Side Tables")).toBe(false);
  });
  it("retains every matching asset beyond the former 60-item carousel cap", () => {
    expect(filterVisualiserCatalog(Array.from({ length: 75 }, (_, i) => ({ ...chair, id: String(i) })))).toHaveLength(75);
  });
});