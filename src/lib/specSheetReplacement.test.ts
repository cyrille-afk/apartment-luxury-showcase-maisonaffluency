import { describe, expect, it } from 'vitest';
import { replacementCandidates, type ReplacementProduct } from './specSheetReplacement';
const source: ReplacementProduct = { id: 'old', product_name: 'Frenchmen Street Lounge Chair', category: 'Seating', brand_name: 'Sebastian Herkner' };
const complete: ReplacementProduct = { ...source, id: 'full', brand_name: 'Man of Parts', description: 'Editorial summary', size_variants: [{ base: 'Tobacco Oak', top: 'COM Fabric' }], rrp_price_cents: 479100 };
describe('specification catalogue replacement', () => {
  it('offers the complete same product across maker credits', () => expect(replacementCandidates(source, [complete])).toEqual([complete]));
  it('rejects a record without descriptions', () => expect(replacementCandidates(source, [{ ...complete, description: null }])).toEqual([]));
  it('rejects a record without finishes', () => expect(replacementCandidates(source, [{ ...complete, size_variants: [] }])).toEqual([]));
  it('requires catalogue retail pricing, not quote or wholesale fallback', () => expect(replacementCandidates(source, [{ ...complete, rrp_price_cents: null }])).toEqual([]));
  it('never substitutes another product, category or hidden record', () => expect(replacementCandidates(source, [{ ...complete, product_name: 'Frenchmen Street Armchair' }, { ...complete, category: 'Tables' }, { ...complete, is_hidden: true }])).toEqual([]));
});