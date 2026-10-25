export type ContentVerdict = "prices_detected" | "possible_prices" | "no_prices_detected" | "unscanned";
export type ContentTarget = { key: string; kind: "public_file" | "cover"; bucket: string | null; path: string | null; url: string | null; label: string; revision: string };
export type ContentCheck = { target_key: string; revision: string; kind: string; verdict: ContentVerdict; evidence: string; checked_at: string };
export type ContentInventory = { targets: ContentTarget[]; checks: ContentCheck[] };

// Inspect bytes, never names or declared content types.
export function detectAuditMedia(bytes: Uint8Array): "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | "image/gif" | null {
  const ascii = new TextDecoder().decode(bytes.slice(0, 1024));
  if (ascii.includes("%PDF-")) return "application/pdf";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes[0] === 137 && ascii.slice(1, 4) === "PNG") return "image/png";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "image/webp";
  if (ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a")) return "image/gif";
  return null;
}

export function currentContentCheck(target: ContentTarget, checks: ContentCheck[]) {
  return checks.find((check) => check.target_key === target.key && check.revision === target.revision);
}

export function auditAssetUrl(target: ContentTarget, storageOrigin: string): URL {
  if (target.kind === "public_file" && target.bucket && target.path) {
    return new URL(`/storage/v1/object/public/${encodeURIComponent(target.bucket)}/${target.path.split("/").map(encodeURIComponent).join("/")}`, storageOrigin);
  }
  const url = new URL(target.url ?? "");
  if (url.protocol !== "https:" || (url.origin !== storageOrigin && url.hostname !== "res.cloudinary.com") || url.username || url.password) {
    throw new Error("Cover host is not approved for inspection.");
  }
  return url;
}