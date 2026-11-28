import { buildReferenceManifest, type ProductReferenceManifestEntry } from "../../supabase/functions/_shared/productReferenceManifest";

export const PRODUCT_REFERENCE_MAX_PX = 1024;
const SIZE_TOKEN = /^(?:w|h|c|q|f|dpr|ar)_/;

/** Ask Cloudinary for a large original instead of a thumbnail transform; other hosts are unchanged. */
export function productReferenceSourceUrl(value: string): string {
  if (value.startsWith("data:") || value.startsWith("blob:")) return value;
  let url: URL;
  try { url = new URL(value, window.location.origin); } catch { return value; }
  if (url.hostname !== "res.cloudinary.com") return url.href;
  const marker = "/image/upload/";
  const at = url.pathname.indexOf(marker);
  if (at < 0) return url.href;
  const segments = url.pathname.slice(at + marker.length).split("/");
  const transforms: string[] = [];
  while (segments[0] && /^[a-z]{1,3}_[^/]+(?:,[a-z]{1,3}_[^/]+)*$/.test(segments[0]) && !/^v\d+$/.test(segments[0])) {
    const kept = segments.shift()!.split(",").filter(token => !SIZE_TOKEN.test(token));
    if (kept.length) transforms.push(kept.join(","));
  }
  url.pathname = `${url.pathname.slice(0, at + marker.length)}${[...transforms, "c_limit,w_2048,h_2048,q_auto:best", ...segments].join("/")}`;
  return url.href;
}

export function fitWithin(width: number, height: number, max = PRODUCT_REFERENCE_MAX_PX): { width: number; height: number } {
  if (!(width > 0 && height > 0)) throw new Error("Invalid image size.");
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export class ProductReferenceError extends Error {
  constructor(readonly productName: string) { super(`${productName}: the product photo could not be loaded, so nothing was generated. Re-select the piece or replace its photo.`); }
}

async function loadAndResize(source: string): Promise<string> {
  const response = await fetch(productReferenceSourceUrl(source), { mode: "cors", credentials: "same-origin" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Not an image");
  const bitmap = await createImageBitmap(blob);
  try {
    const size = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width; canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.fillStyle = "#ffffff"; // transparent cut-outs become clean studio white, never black
    context.fillRect(0, 0, size.width, size.height);
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    if (!dataUrl.startsWith("data:image/jpeg;base64,")) throw new Error("Encoding failed");
    return dataUrl;
  } finally { bitmap.close(); }
}

export type PreparedReferenceInput = ProductReferenceManifestEntry & { dataUrl: string };

/** Every selected piece must load; one failure rejects the whole request before any AI call. */
export async function prepareProductReferenceImages<T extends { id?: string | null; product_name: string; image_url: string | null }>(pieces: T[]): Promise<{ pieces: (T & { reference_image_data: string })[]; inputs: PreparedReferenceInput[] }> {
  const cache = new Map<string, Promise<string>>();
  const prepared = await Promise.all(pieces.map(async piece => {
    if (!piece.image_url) throw new ProductReferenceError(piece.product_name);
    let pending = cache.get(piece.image_url);
    if (!pending) { pending = loadAndResize(piece.image_url); cache.set(piece.image_url, pending); }
    try { return { ...piece, reference_image_data: await pending }; }
    catch { throw new ProductReferenceError(piece.product_name); }
  }));
  const manifest = await buildReferenceManifest(prepared);
  return { pieces: prepared, inputs: manifest.map((entry, index) => ({ ...entry, dataUrl: prepared[index]!.reference_image_data })) };
}
