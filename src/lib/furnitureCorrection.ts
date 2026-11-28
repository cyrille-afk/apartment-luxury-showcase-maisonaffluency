import { resignPrivateTradeUrl } from "./privateTradeUpload";
import type { ProposalProduct } from "./proposalRenderDraft";

export type CorrectionArea = { x: number; y: number; width: number; height: number };
export function correctionBounds(area: CorrectionArea, width: number, height: number) {
  if (![area.x, area.y, area.width, area.height].every(Number.isFinite) || area.x < 0 || area.y < 0 || area.width < 1 || area.height < 1 || area.x + area.width > 100 || area.y + area.height > 100) throw new Error("Mark an area around the incorrect piece.");
  const x = Math.floor(area.x * width / 100), y = Math.floor(area.y * height / 100);
  return { x, y, right: Math.min(width, Math.ceil((area.x + area.width) * width / 100)), bottom: Math.min(height, Math.ceil((area.y + area.height) * height / 100)) };
}
export function mergeCorrectionPixels(original: Uint8ClampedArray, edited: Uint8ClampedArray, width: number, height: number, area: CorrectionArea) {
  if (original.length !== width * height * 4 || edited.length !== original.length) throw new Error("Image sizes do not match.");
  const bounds = correctionBounds(area, width, height);
  const result = original.slice();
  const feather = Math.min(16, Math.floor(Math.min(bounds.right - bounds.x, bounds.bottom - bounds.y) / 10));
  for (let y = bounds.y; y < bounds.bottom; y++) {
    for (let x = bounds.x; x < bounds.right; x++) {
      const weight = feather ? Math.min(1, Math.min(x - bounds.x, bounds.right - 1 - x, y - bounds.y, bounds.bottom - 1 - y) / feather) : 1;
      for (let channel = 0; channel < 4; channel++) {
        const index = (y * width + x) * 4 + channel;
        result[index] = Math.round((original[index] ?? 0) * (1 - weight) + (edited[index] ?? 0) * weight);
      }
    }
  }
  return result;
}
export function furnitureCorrectionRequest(imageUrl: string, piece: ProposalProduct, area: CorrectionArea) {
  correctionBounds(area, 100, 100);
  return { mode: "product_swap", imageUrl, referenceImageUrl: null, swaps: [{ imageUrl: piece.image_url,
    prompt: `Correct ONLY the incorrect furniture inside the rectangle x=${area.x.toFixed(2)}% to ${(area.x + area.width).toFixed(2)}%, y=${area.y.toFixed(2)}% to ${(area.y + area.height).toFixed(2)}% (origin top-left). Replace it with exactly ONE ${piece.product_name} by ${piece.brand_name} from IMAGE 2. Reproduce its exact silhouette, legs and design, not another selected chair. Dimensions: ${piece.dimensions || "unconfirmed; do not invent measurements"}. Materials: ${piece.materials || "as photographed"}. Selected finishes: ${piece.selected_finishes?.map(f => `${f.axis}: ${f.name}`).join("; ") || "as photographed"}. ${piece.material_override ? `Finish override: ${piece.material_override}.` : ""} Keep the existing position, floor contact, camera, scale and lighting. Correct only this piece and its necessary contact shadow. Do not add a duplicate, move other furniture or change architecture. Preserve every pixel outside the rectangle.` }] };
}
export async function compositeFurnitureCorrection(originalUrl: string, editedUrl: string, area: CorrectionArea): Promise<Blob> {
  const load = async (url: string) => {
    const response = await fetch(await resignPrivateTradeUrl(url));
    if (!response.ok) throw new Error("The room image could not be loaded.");
    return createImageBitmap(await response.blob());
  };
  const original = await load(originalUrl);
  try {
    const edited = await load(editedUrl);
    try {
      const canvas = document.createElement("canvas"); canvas.width = original.width; canvas.height = original.height;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Image editing is unavailable.");
      ctx.drawImage(original, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(edited, 0, 0, canvas.width, canvas.height);
      pixels.data.set(mergeCorrectionPixels(pixels.data, ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, area));
      ctx.putImageData(pixels, 0, 0);
      return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not save the corrected image.")), "image/png"));
    } finally { edited.close(); }
  } finally { original.close(); }
}