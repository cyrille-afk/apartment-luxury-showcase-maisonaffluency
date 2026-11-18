import { describe, expect, it } from "vitest";
import { isApprovedViewingRoomAlternative } from "./viewingRoomAlternatives";

const slot = { id: "original", category: "Seating", subcategory: "Armchairs" };
const candidate = { id: "alternative", category: "Seating", subcategory: "Chairs", glb_url: "https://example.com/chair.glb", is_active: true, is_hidden: false };
describe("approved Cipriani catalogue alternatives", () => {
  it("accepts all 3D items in the same category", () => expect(isApprovedViewingRoomAlternative(slot, candidate)).toBe(true));
  it("accepts the same explicit subcategory independently", () => expect(isApprovedViewingRoomAlternative(slot, { ...candidate, category: "Other", subcategory: "Armchairs" })).toBe(true));
  it("matches each slash-separated category independently", () => expect(isApprovedViewingRoomAlternative(slot, { ...candidate, category: "Tables / Seating" })).toBe(true));
  it("rejects unrelated categories and subcategories", () => expect(isApprovedViewingRoomAlternative(slot, { ...candidate, category: "Lighting", subcategory: "Floor Lights" })).toBe(false));
  it("requires a valid existing 3D file", () => expect(isApprovedViewingRoomAlternative(slot, { ...candidate, glb_url: "https://example.com/photo.jpg" })).toBe(false));
  it("does not include the original piece", () => expect(isApprovedViewingRoomAlternative(slot, { ...candidate, id: "original" })).toBe(false));
  it("does not expose hidden pieces", () => expect(isApprovedViewingRoomAlternative(slot, { ...candidate, is_hidden: true })).toBe(false));
  it("does not expose inactive pieces", () => expect(isApprovedViewingRoomAlternative(slot, { ...candidate, is_active: false })).toBe(false));
});