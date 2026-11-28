export { ROOM_MASTER_VIEWS, moveRoomRig, requireRoomTurntable } from "../../supabase/functions/_shared/roomTurntable";
import { resignPrivateTradeUrl, uploadPrivateTradeAsset } from "./privateTradeUpload";
import { ROOM_MASTER_VIEWS } from "../../supabase/functions/_shared/roomTurntable";

export async function roomCropDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve,reject) => { const reader = new FileReader();reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Room crop could not be prepared."));reader.onerror = () => reject(new Error("Room crop could not be prepared."));reader.readAsDataURL(blob); });
}

export async function publishableRoomAngles(url: string, masterUrl: string): Promise<{ label: string; url: string }[]> {
  const response = await fetch(await resignPrivateTradeUrl(url));
  if (!response.ok) throw new Error("The two-angle render could not load.");
  const bitmap = await createImageBitmap(await response.blob());
  try {
    if (Math.abs(bitmap.width/bitmap.height-16/9) > 0.02) throw new Error("Expected a 16:9 two-angle contact sheet.");
    const batch = crypto.randomUUID();
    const shifted = await Promise.all(ROOM_MASTER_VIEWS.slice(1).map(async (view,i) => {
      const x = i;
      const left = Math.floor(x*bitmap.width/2), top = 0;
      const width = Math.floor((x+1)*bitmap.width/2)-left, height = bitmap.height;
      const canvas = document.createElement("canvas");canvas.width = width;canvas.height = height;
      const ctx = canvas.getContext("2d");if (!ctx) throw new Error("Angle export unavailable.");
      ctx.drawImage(bitmap,left,top,width,height,0,0,width,height);
      const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Angle export failed.")),"image/png"));
      return { label: view.label, url: await uploadPrivateTradeAsset(`axonometric-sources/room-angles/${batch}/${i+1}.png`,blob,"image/png") };
    }));
    return [{ label: ROOM_MASTER_VIEWS[0].label,url: masterUrl },...shifted];
  } finally { bitmap.close(); }
}