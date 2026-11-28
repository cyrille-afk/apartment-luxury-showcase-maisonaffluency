import { describe, expect, it } from "vitest";
import { fullFrameFurnitureLock, roomFurnitureReferenceImages, requireRoomFurnitureReferences, selectSecondaryReferencePhotos, type RoomFurnitureReference } from "../../supabase/functions/_shared/roomFurnitureEditing";

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
  it("selects non-logo secondary angle photos and unlocks Rift CTS when Rift CTS itself is targeted", () => {
    const extras = selectSecondaryReferencePhotos("https://example.com/main.jpg", [
      "https://example.com/main.jpg",
      "https://res.cloudinary.com/demo/image/upload/v1/kerstens_rift_cts-1280_p-1.jpg",
      "https://res.cloudinary.com/demo/image/upload/v1/kerstens_rift_cts-1280_p-2.jpg",
      "https://res.cloudinary.com/demo/image/upload/v1/kerstens_logo_word_white_square.jpg",
    ]);
    expect(extras).toEqual([
      "https://res.cloudinary.com/demo/image/upload/c_pad,w_1024,h_1024,b_white/v1/kerstens_rift_cts-1280_p-1.jpg",
      "https://res.cloudinary.com/demo/image/upload/c_pad,w_1024,h_1024,b_white/v1/kerstens_rift_cts-1280_p-2.jpg",
    ]);
    const rift: RoomFurnitureReference = { product_name: "Rift CTS", image_url: "https://example.com/main.jpg", dimensions: "W 108 × D 108 × H 28 cm – 254 kg" };
    const chair: RoomFurnitureReference = { product_name: "Rua Leblon", image_url: "https://example.com/rua.jpg" };
    const targeted = fullFrameFurnitureLock([rift], ["Rift CTS"]);
    expect(targeted).toContain("Rift CTS IS the explicit target");
    expect(targeted).toContain("COMPLETELY ERASE");
    expect(targeted).toContain("1:1 rounded-square (squircle)");
    expect(targeted).not.toContain("keep the exact silhouette, carved stone base, and wood top of the center Rift CTS Coffee Table unchanged");
    const keptImages = roomFurnitureReferenceImages([rift, chair], ["Rift CTS"]).filter(p => p.image_url).map(p => p.image_url?.url);
    expect(keptImages).toEqual(["https://example.com/rua.jpg"]);
    const untouched = fullFrameFurnitureLock([rift], ["Rua Leblon"]);
    expect(untouched).toContain("keep the exact silhouette, carved stone base, and wood top of the center Rift CTS Coffee Table unchanged");
  });
});