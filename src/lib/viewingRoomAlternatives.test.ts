import { describe, expect, it } from "vitest";
import { isApprovedViewingRoomAlternative, viewingRoomFootprintFits, viewingRoomSwapsEnabled } from "./viewingRoomAlternatives";

const slot = { id: "original", category: "Seating", subcategory: "Armchairs" };
const candidate = { id: "alternative", category: "Seating", subcategory: "Chairs", glb_url: "https://example.com/chair.glb", is_active: true, is_hidden: false };
describe("approved Cipriani catalogue alternatives", () => {
  it("requires both item and parent-package swap permissions", () => {
    expect(viewingRoomSwapsEnabled(true, true)).toBe(true);
    expect(viewingRoomSwapsEnabled(true, false)).toBe(false);
    expect(viewingRoomSwapsEnabled(false, true)).toBe(false);
  });
  it("accepts all 3D items in the same category", () => expect(isApprovedViewingRoomAlternative(slot, candidate)).toBe(true));
  it("accepts the same explicit subcategory independently", () => expect(isApprovedViewingRoomAlternative(slot, { ...candidate, category: "Other", subcategory: "Armchairs" })).toBe(true));
  it("matches each slash-separated category independently", () => expect(isApprovedViewingRoomAlternative(slot, { ...candidate, category: "Tables / Seating" })).toBe(true));
  it("rejects unrelated categories and subcategories", () => expect(isApprovedViewingRoomAlternative(slot, { ...candidate, category: "Lighting", subcategory: "Floor Lights" })).toBe(false));
  it("requires a valid existing 3D file", () => expect(isApprovedViewingRoomAlternative(slot, { ...candidate, glb_url: "https://example.com/photo.jpg" })).toBe(false));
  it("does not include the original piece", () => expect(isApprovedViewingRoomAlternative(slot, { ...candidate, id: "original" })).toBe(false));
  it("does not expose hidden pieces", () => expect(isApprovedViewingRoomAlternative(slot, { ...candidate, is_hidden: true })).toBe(false));
  it("does not expose inactive pieces", () => expect(isApprovedViewingRoomAlternative(slot, { ...candidate, is_active: false })).toBe(false));
  it("includes the exact ±20% width and depth boundaries", () => {
    const footprint = { width_mm: 1000, depth_mm: 800 };
    expect(viewingRoomFootprintFits(footprint, { width_mm: 800, depth_mm: 640 })).toBe(true);
    expect(viewingRoomFootprintFits(footprint, { width_mm: 1200, depth_mm: 960 })).toBe(true);
  });
  it("excludes a piece when either footprint dimension exceeds ±20%", () => {
    const footprint = { width_mm: 1000, depth_mm: 800 };
    expect(viewingRoomFootprintFits(footprint, { width_mm: 1201, depth_mm: 800 })).toBe(false);
    expect(viewingRoomFootprintFits(footprint, { width_mm: 1000, depth_mm: 639 })).toBe(false);
  });
  it("does not infer missing or zero footprints", () => {
    expect(viewingRoomFootprintFits({ width_mm: null, depth_mm: 800 }, { width_mm: 900, depth_mm: 800 })).toBe(false);
    expect(viewingRoomFootprintFits({ width_mm: 0, depth_mm: 800 }, { width_mm: 0, depth_mm: 800 })).toBe(false);
  });
});