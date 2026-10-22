import { describe, expect, it } from "vitest";
import type { CatalogManifest, CatalogManifestDesigner, CatalogManifestPick } from "./catalogManifest";
import { isPublicGalleryMaker, publicGalleryPicks } from "./publicGalleryCatalog";

const maker = (id: string, name: string, trade_only = false): CatalogManifestDesigner => ({ id, name, slug: name.toLowerCase().replaceAll(" ", "-"), display_name: null, source: null, founder: null, era: null, country: null, is_published: true, trade_only });
const pick = (id: string, title: string, designer_id: string) => ({ id, title, designer_id }) as CatalogManifestPick;
const pieces = [
  pick("11179934-a17e-4d81-9f49-b84c19b43a4a", "Puzzle Console", "amar"),
  pick("6f7996bc-a985-45ec-8c31-bf97c4a71dd4", "Puzzle Dining Table", "amar"),
  pick("b0578007-d436-4fac-866f-1964b459942a", "Canyon Console", "amar"),
];

describe("public gallery ownership", () => {
  it("excludes all three Michel Amar collaborations when their maker row is missing", () => {
    const manifest: CatalogManifest = { generated_at: "", designers: [maker("frank", "Jean-Michel Frank")], picks: [...pieces, pick("stool", "X Stool", "frank")] };
    expect(publicGalleryPicks(manifest).map((p) => p.id)).toEqual(["stool"]);
  });
  it("excludes trade-only owners even when present in the catalogue", () => {
    const manifest: CatalogManifest = { generated_at: "", designers: [maker("amar", "Michel Amar Studio", true)], picks: pieces };
    expect(publicGalleryPicks(manifest)).toEqual([]);
    expect(isPublicGalleryMaker("Michel Amar Studio", manifest)).toBe(false);
  });
  it("allows static gallery candidates only for a verified published public maker", () => {
    const manifest: CatalogManifest = { generated_at: "", designers: [maker("frank", "Jean-Michel Frank"), { ...maker("draft", "Draft Studio"), is_published: false }], picks: [] };
    expect(isPublicGalleryMaker("Jean-Michel Frank", manifest)).toBe(true);
    expect(isPublicGalleryMaker("Maison Affluency", manifest)).toBe(false);
    expect(isPublicGalleryMaker("Draft Studio", manifest)).toBe(false);
    expect(isPublicGalleryMaker("Michel Amar Studio", undefined)).toBe(false);
  });
});