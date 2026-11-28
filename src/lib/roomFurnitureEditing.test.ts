import { describe, expect, it } from "vitest";
import { roomFurnitureReferenceImages, requireRoomFurnitureReferences, type RoomFurnitureReference } from "../../supabase/functions/_shared/roomFurnitureEditing";

describe("full-frame room furniture reference routing", () => {
  it("passes all ten active references without the former five-photo truncation", () => {
    const pieces: RoomFurnitureReference[] = Array.from({ length: 10 }, (_, i) => ({ product_name: `Piece ${i}`, image_url: `https://example.com/piece-${i}.png` }));
    const images = roomFurnitureReferenceImages(pieces).filter(p => p.image_url).map(p => p.image_url?.url);
    expect(images).toEqual(pieces.map(p => p.image_url));
    expect(images).toHaveLength(10);
  });
  it("requires visual ground truth for every active item", () => {
    expect(() => requireRoomFurnitureReferences([{ product_name: "Rift CTS", image_url: "" }])).toThrow();
    expect(() => requireRoomFurnitureReferences([])).toThrow();
  });
});