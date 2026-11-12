import { cleanSpecDescription, specClientPriceCents, specFinishes, type SpecProductSource } from './specSheetCard';

export type ReplacementProduct = SpecProductSource & {
  id: string; product_name: string; brand_name?: string | null; category?: string | null;
  currency?: string | null; is_active?: boolean | null; is_hidden?: boolean | null;
};
const normalize = (s?: string | null) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
export function completeReplacement(p: ReplacementProduct): boolean {
  return p.is_active !== false && p.is_hidden !== true && !!cleanSpecDescription(p) && specFinishes(p).length > 0 && specClientPriceCents(p) !== null;
}
export function replacementCandidates(source: ReplacementProduct, products: ReplacementProduct[]): ReplacementProduct[] {
  return products.filter(p => p.id !== source.id && normalize(p.product_name) === normalize(source.product_name)
    && normalize(p.category) === normalize(source.category) && completeReplacement(p));
}