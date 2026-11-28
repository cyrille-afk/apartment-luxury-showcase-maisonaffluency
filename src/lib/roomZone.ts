export { ROOM_TYPES, validRoomZone, roomCropCamera } from "../../supabase/functions/_shared/roomZone";
export type { RoomType, RoomZone } from "../../supabase/functions/_shared/roomZone";
import { validRoomZone, type RoomZone } from "../../supabase/functions/_shared/roomZone";
import { resignPrivateTradeUrl } from "./privateTradeUpload";

export async function cropRoomPlan(url: string, zone: RoomZone): Promise<Blob> {
  if (!validRoomZone(zone)) throw new Error("Draw a room crop first.");
  const response = await fetch(await resignPrivateTradeUrl(url));
  if (!response.ok) throw new Error("The floor plan couldn’t load. Please retry.");
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1,Math.round(bitmap.width*zone.width/100));
    canvas.height = Math.max(1,Math.round(bitmap.height*zone.height/100));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Room cropping is unavailable in this browser.");
    ctx.drawImage(bitmap,bitmap.width*zone.x/100,bitmap.height*zone.y/100,bitmap.width*zone.width/100,bitmap.height*zone.height/100,0,0,canvas.width,canvas.height);
    return await new Promise<Blob>((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("The room crop couldn’t be prepared.")),"image/png"));
  } finally { bitmap.close(); }
}