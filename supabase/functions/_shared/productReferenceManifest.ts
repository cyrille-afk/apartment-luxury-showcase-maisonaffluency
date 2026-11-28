/** Shared by the browser and the edge function: proves which product photos conditioned a render. */
export type ProductReferenceManifestEntry = { reference: number; id: string | null; product_name: string; digest: string };
export type BrowserReferencePiece = { id?: string | null; product_name: string; reference_image_data?: string | null };

const INLINE_IMAGE = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

export async function referenceDigest(dataUrl: string): Promise<string> {
  const bytes = new TextEncoder().encode(dataUrl);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash.slice(0, 12), b => b.toString(16).padStart(2, "0")).join("");
}

/** Browser-prepared requests never fall back to text-only or server-fetched product photos. */
export function requireBrowserReferences(pieces: BrowserReferencePiece[]): void {
  if (!Array.isArray(pieces) || !pieces.length || pieces.length > 10) throw new Error("Select between 1 and 10 products.");
  for (const piece of pieces) {
    if (typeof piece?.reference_image_data !== "string" || !INLINE_IMAGE.test(piece.reference_image_data)) {
      throw new Error(`${piece?.product_name || "A selected piece"} has no prepared product photo. Nothing was generated.`);
    }
  }
}

/** Reference 1 is the base room image; product photos are References 2…N in selection order. */
export async function buildReferenceManifest(pieces: BrowserReferencePiece[]): Promise<ProductReferenceManifestEntry[]> {
  requireBrowserReferences(pieces);
  return Promise.all(pieces.map(async (piece, index) => ({
    reference: index + 2, id: piece.id ?? null, product_name: piece.product_name, digest: await referenceDigest(piece.reference_image_data!),
  })));
}

/** Verified only when the server attached this exact photo at the expected reference number. */
export function verifyReferenceManifest(sent: ProductReferenceManifestEntry[], received: unknown): boolean[] {
  const list = Array.isArray(received) ? received as Partial<ProductReferenceManifestEntry>[] : [];
  return sent.map(entry => list.some(r => r.reference === entry.reference && r.digest === entry.digest && (r.id ?? null) === entry.id));
}
