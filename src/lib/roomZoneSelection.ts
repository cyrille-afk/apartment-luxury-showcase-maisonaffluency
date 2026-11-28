import { ROOM_TYPES, roomCropCamera, validRoomZone, type RoomZone } from "../../supabase/functions/_shared/roomZone";
import { validEyeLevelCamera, type EyeLevelCamera } from "../../supabase/functions/_shared/eyeLevelCamera";

// Keep deliberately placed cameras; a newly cropped room needs its own valid camera.
export function cameraForRoomCrop(camera: EyeLevelCamera | null, zone: RoomZone | null): EyeLevelCamera | null {
  if (!zone || !validRoomZone(zone)) return camera;
  if (camera && validEyeLevelCamera(camera)) {
    try { roomCropCamera(camera, zone); return camera; } catch { /* Rehome outside-room pins. */ }
  }
  const next = {
    position: { x: zone.x + zone.width * 0.5, y: zone.y + zone.height * 0.8 },
    target: { x: zone.x + zone.width * 0.5, y: zone.y + zone.height * 0.2 },
  };
  return validEyeLevelCamera(next) ? next : {
    position: { x: zone.x + zone.width * 0.1, y: zone.y + zone.height * 0.9 },
    target: { x: zone.x + zone.width * 0.9, y: zone.y + zone.height * 0.1 },
  };
}

export function productsForRoomCrop<T extends { room_section?: string | undefined }>(products: T[], zone: RoomZone | null): T[] {
  if (!zone) return products;
  return products.filter(piece => {
    const name = (piece.room_section ?? "").trim().toLowerCase();
    // Unassigned selections belong to the room being composed, not an invisible room.
    return !name || name === zone.room_name.trim().toLowerCase() || name === ROOM_TYPES[zone.room_type].toLowerCase() || (zone.room_type === "primary_bedroom" && name === "bedroom");
  });
}