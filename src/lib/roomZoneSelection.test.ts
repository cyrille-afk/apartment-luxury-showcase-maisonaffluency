import { describe, expect, it } from "vitest";
import { cameraForRoomCrop, productsForRoomCrop } from "./roomZoneSelection";
import { roomCropCamera } from "../../supabase/functions/_shared/roomZone";

const zone = { x: 48, y: 60, width: 38, height: 38, room_type: "living_room" as const, room_name: "Living Room" };
describe("room crop selection recovery", () => {
  it("rehomes the old outside-room camera into the selected crop", () => {
    const camera = cameraForRoomCrop({ position: { x: 45, y: 65 }, target: { x: 46, y: 45 } }, zone);
    expect(camera).toEqual({ position: { x: 67, y: 90.4 }, target: { x: 67, y: 67.6 } });
    if (!camera) throw new Error("Expected crop camera");
    expect(roomCropCamera(camera, zone).position.y).toBeCloseTo(80);
  });
  it("preserves a valid deliberately positioned camera", () => {
    const camera = { position: { x: 60, y: 90 }, target: { x: 75, y: 70 } };
    expect(cameraForRoomCrop(camera, zone)).toBe(camera);
  });
  it("includes all five selected unassigned pieces in the room", () => {
    const pieces = ["Yoma CLW Console", "Rift CTS", "Mono STS", "GUM 1", "GUM 2"].map(id => ({ id, room_section: undefined }));
    expect(productsForRoomCrop(pieces, zone).map(p => p.id)).toEqual(["Yoma CLW Console", "Rift CTS", "Mono STS", "GUM 1", "GUM 2"]);
  });
  it("excludes explicitly assigned pieces from other rooms", () => {
    expect(productsForRoomCrop([{ id: "living", room_section: "Living Room" }, { id: "dining", room_section: "Dining Room" }, { id: "new", room_section: " " }], zone).map(p => p.id)).toEqual(["living", "new"]);
  });
  it("creates valid distinct camera pins even in a minimum-size crop", () => {
    const small = { ...zone, width: 2, height: 2 };
    const camera = cameraForRoomCrop(null, small);
    if (!camera) throw new Error("Expected crop camera");
    expect(() => roomCropCamera(camera, small)).not.toThrow();
  });
});