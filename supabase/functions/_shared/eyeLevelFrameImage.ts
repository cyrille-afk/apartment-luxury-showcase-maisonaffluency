import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";
import { eyeLevelFrame, eyeLevelOutputBounds, requireStableRoomFrame } from "./eyeLevelFraming.ts";
import { safeFetch } from "./safeFetch.ts";

async function decode(url: string) {
  const response = url.startsWith("data:image/") ? await fetch(url) : await safeFetch(url);
  if (!response.ok) throw new Error("The room image could not be loaded. Your room is unchanged.");
  return Image.decode(new Uint8Array(await response.arrayBuffer()));
}
async function dataUrl(image: Image) {
  const bytes = await image.encode();
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:image/png;base64,${btoa(binary)}`;
}
export async function prepareEyeLevelFrame(url: string) {
  const source = await decode(url);
  if (source.width * source.height > 24000000) throw new Error("Use a room image below 24 megapixels.");
  const frame = eyeLevelFrame(source.width, source.height);
  const canvas = new Image(frame.canvasWidth, frame.canvasHeight).fill(0x808080ff);
  canvas.composite(source, frame.x, frame.y);
  return { frame, imageUrl: await dataUrl(canvas) };
}
export async function restoreEyeLevelFrame(url: string, frame: ReturnType<typeof eyeLevelFrame>, sourceUrl?: string) {
  const output = await decode(url);
  const bounds = eyeLevelOutputBounds(frame, output.width, output.height);
  // Remove only our temporary matte, never any part of the original room.
  output.crop(bounds.x, bounds.y, bounds.width, bounds.height);
  output.resize(frame.width, frame.height);
  if (sourceUrl) {
    const source = await decode(sourceUrl);
    const strip = (image: Image) => {
      const bytes: number[] = [];
      // Compare the unobstructed upper 20% at a fixed grid, excluding alpha.
      for (let y = 0; y < 20; y++) for (let x = 0; x < 100; x++) {
        const offset = (Math.min(image.height - 1, Math.floor(y * image.height / 100)) * image.width + Math.min(image.width - 1, Math.floor(x * image.width / 100))) * 4;
        for (let c = 0; c < 3; c++) bytes.push(image.bitmap[offset + c] ?? 0);
      }
      return bytes;
    };
    requireStableRoomFrame(strip(source), strip(output));
  }
  return dataUrl(output);
}