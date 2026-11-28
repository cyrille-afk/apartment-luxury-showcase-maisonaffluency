import { requireRoomFurnitureReferences, type RoomFurnitureReference } from "./roomFurnitureEditing.ts";
import { Buffer } from "node:buffer";

export type FurnitureImageInput = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

/** Remove delivery-size transforms, not material edits, version paths or signed access tokens. */
export function fullResolutionStudioUrl(value: string): string {
  if (value.startsWith("data:")) return value;
  const url = new URL(value);
  if (url.hostname === "res.cloudinary.com") {
    const marker = "/image/upload/";
    const at = url.pathname.indexOf(marker);
    if (at >= 0) {
      const segments = url.pathname.slice(at + marker.length).split("/");
      while (segments[0] && /^(?:(?:w|h|c|q|f|dpr|ar|e|a|b|g|x|y|r|l|u|o|fl)_[^/]+)(?:,(?:w|h|c|q|f|dpr|ar|e|a|b|g|x|y|r|l|u|o|fl)_[^/]+)*$/.test(segments[0])) {
        const transform = segments.shift();
        const kept = transform?.split(",").filter(token => !/^(?:w|h|c|q|f|dpr|ar)_/.test(token)) ?? [];
        if (kept.length) { segments.unshift(kept.join(",")); break; }
      }
      url.pathname = url.pathname.slice(0, at + marker.length) + segments.join("/");
    }
  } else if (url.hostname.endsWith(".supabase.co") && url.pathname.includes("/storage/v1/render/image/")) {
    url.pathname = url.pathname.replace("/storage/v1/render/image/", "/storage/v1/object/");
    for (const key of ["width", "height", "quality", "resize"]) url.searchParams.delete(key);
  }
  return url.href;
}

/** Embed original bytes; a broken reference must stop the request before inference. */
export async function fetchStudioPhoto(value: string, label: string, fetcher: typeof fetch = fetch, originalSize = true): Promise<string> {
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(value)) {
    if (value.length > MAX_PHOTO_BYTES * 4 / 3 + 256) throw new Error(`${label} photo is too large.`);
    return value;
  }
  let url: URL;
  try { url = new URL(originalSize ? fullResolutionStudioUrl(value) : value); } catch { throw new Error(`${label} needs a valid studio photo.`); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || /^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|\[)/i.test(url.hostname)) {
    throw new Error(`${label} needs a public HTTPS studio photo.`);
  }
  const response = await fetcher(url.href, { redirect: "manual" });
  if (!response.ok) throw new Error(`${label} studio photo could not be loaded. Your room is unchanged.`);
  const type = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (!type || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(type)) throw new Error(`${label} reference is not a supported product image.`);
  if (Number(response.headers.get("content-length")) > MAX_PHOTO_BYTES) throw new Error(`${label} photo is too large.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw new Error(`${label} photo is empty or too large.`);
  return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
}

/** Shell is IMAGE 1; primary studio photos are always IMAGE 2 onward, before any swatches/layout. */
export async function studioFurnitureInputs(pieces: RoomFurnitureReference[], fetcher: typeof fetch = fetch, preserveAppearance = false): Promise<FurnitureImageInput[]> {
  requireRoomFurnitureReferences(pieces);
  const cache = new Map<string, Promise<string>>();
  const photo = (url: string, label: string, originalSize = true) => {
    const key = originalSize ? fullResolutionStudioUrl(url) : url;
    let pending = cache.get(key);
    if (!pending) { pending = fetchStudioPhoto(key, label, fetcher, originalSize); cache.set(key, pending); }
    return pending;
  };
  const primary: FurnitureImageInput[][] = await Promise.all(pieces.map(async (piece, index) => [
    { type: "text", text: `IMAGE ${index + 2}: PRODUCT ${index + 1} — ${piece.product_name} by ${piece.brand_name || "recorded maker"}. Original studio photograph: exact visual replica, not a style suggestion. Match silhouette, proportions, legs, joinery and materials; no generic substitute or redesign.` },
    { type: "image_url", image_url: { url: await photo(piece.image_url, piece.product_name) } },
  ]));
  const supplements: FurnitureImageInput[] = [];
  for (const [index, piece] of pieces.entries()) {
    for (const finish of piece.selected_finishes ?? []) {
      if (!finish.image_url) continue; // Unpictured finishes stay explicitly unpictured, never invented.
      supplements.push({ type: "text", text: `PRODUCT ${index + 1} (${piece.product_name}), selected ${finish.axis}: ${finish.name}. ${preserveAppearance ? "Identity reference ONLY: retain the existing finish in IMAGE 1 unless this exact axis is explicitly requested to change. Moving or removing a piece never authorizes a finish change." : "Apply this swatch ONLY to this product's named axis; preserve its studio-photo geometry and all other materials."}` });
      supplements.push({ type: "image_url", image_url: { url: await photo(finish.image_url, `${piece.product_name} ${finish.axis}`, false) } });
    }
    for (const extra of piece.secondary_image_urls ?? []) {
      supplements.push({ type: "text", text: `Additional studio angle for PRODUCT ${index + 1} (${piece.product_name}); same design as IMAGE ${index + 2}, confirming sculptural silhouette, footprint and joinery.` });
      supplements.push({ type: "image_url", image_url: { url: await photo(extra, piece.product_name) } });
    }
  }
  return [...primary.flat(), ...supplements];
}

/** Active render is always first; every placed instance keeps its original visual references. */
export async function proposalRefinementInputs(baseImage: string, pieces: RoomFurnitureReference[], fetcher: typeof fetch = fetch): Promise<FurnitureImageInput[]> {
  if (!baseImage) throw new Error("The active proposal image is required. Your room is unchanged.");
  return [
    { type: "image_url", image_url: { url: baseImage } },
    ...await studioFurnitureInputs(pieces, fetcher, true),
  ];
}