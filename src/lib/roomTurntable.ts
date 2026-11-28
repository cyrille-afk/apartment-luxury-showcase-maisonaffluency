export { ROOM_CORNER_VIEWS, moveRoomRig, requireRoomTurntable } from "../../supabase/functions/_shared/roomTurntable";
import { resignPrivateTradeUrl, uploadPrivateTradeAsset } from "./privateTradeUpload";
import { ROOM_CORNER_VIEWS } from "../../supabase/functions/_shared/roomTurntable";

export async function roomCropDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve,reject) => { const reader = new FileReader();reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Room crop could not be prepared."));reader.onerror = () => reject(new Error("Room crop could not be prepared."));reader.readAsDataURL(blob); });
}

export async function publishableRoomAngles(url: string): Promise<{ label: string; url: string }[]> {
  const response = await fetch(await resignPrivateTradeUrl(url));
  if (!response.ok) throw new Error("The four-angle render could not load.");
  const bitmap = await createImageBitmap(await response.blob());
  try {
    if (Math.abs(bitmap.width/bitmap.height-1) > 0.02) throw new Error("Expected a square four-angle contact sheet.");
    const batch = crypto.randomUUID();
    return await Promise.all(ROOM_CORNER_VIEWS.map(async (view,i) => {
      const x = i%2, y = Math.floor(i/2);
      const left = Math.floor(x*bitmap.width/2), top = Math.floor(y*bitmap.height/2);
      const width = Math.floor((x+1)*bitmap.width/2)-left, height = Math.floor((y+1)*bitmap.height/2)-top;
      const canvas = document.createElement("canvas");canvas.width = width;canvas.height = height;
      const ctx = canvas.getContext("2d");if (!ctx) throw new Error("Angle export unavailable.");
      ctx.drawImage(bitmap,left,top,width,height,0,0,width,height);
      const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Angle export failed.")),"image/png"));
      return { label: view.label, url: await uploadPrivateTradeAsset(`axonometric-sources/room-angles/${batch}/${i+1}.png`,blob,"image/png") };
    }));
  } finally { bitmap.close(); }
}