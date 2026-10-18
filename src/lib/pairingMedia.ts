import type { PairingSelection } from './curatedPairingConfiguration';
export type PairingMedia = { key: string; label: string; product_image_url?: string | null; macro_image_url?: string | null };
export function pairingMediaKey(selection: PairingSelection, customId?: string) {
  return customId ? `custom:${customId}` : JSON.stringify([selection.base || '', selection.top || '', selection.label || '']);
}
export function parsePairingMedia(raw: unknown): PairingMedia[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is PairingMedia => !!entry && typeof entry.key === 'string' && typeof entry.label === 'string');
}
export function pairingMediaError(entries: PairingMedia[]): string | null {
  if (entries.length > 100) return 'Use at most 100 image assignments.';
  if (new Set(entries.map(e => e.key)).size !== entries.length) return 'Each finish combination can have only one assignment.';
  for (const e of entries) {
    if (!e.key || !e.label) return 'Choose a finish combination.';
    for (const url of [e.product_image_url, e.macro_image_url]) if (url && !/^https:\/\/[^/\s]+\/[^\s]+$/.test(url)) return 'Images require an absolute HTTPS address.';
  }
  return null;
}
export function pairingUploadError(file: Pick<File, 'type' | 'size'>): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a JPEG, PNG or WebP image.';
  if (!file.size || file.size > 20 * 1024 * 1024) return 'Choose an image no larger than 20 MB.';
  return null;
}
export function pairingMediaPreview(hero: string, product: string | null | undefined, macro: string | null | undefined, failed: string[] = []) {
  const dedicated = product && !failed.includes(product) ? product : null;
  const tile = macro && !failed.includes(macro) ? macro : null;
  return { image: dedicated || hero, macro: dedicated ? null : tile, status: dedicated ? 'Finish photo' : tile ? 'Default photo + texture detail' : 'Missing finish photo and texture detail' };
}