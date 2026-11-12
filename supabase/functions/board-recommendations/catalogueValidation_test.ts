import { assertEquals } from 'jsr:@std/assert';
import { isValidatedRecommendation, type RecommendationRecord } from './catalogueValidation.ts';

const canonicalIds = new Set(['yoma-console']);
const consoleRecord: RecommendationRecord = {
  id: 'yoma-console', source: 'curator', title: 'Yoma CLW Console', brand: 'Kerstens',
  category: 'Storage', image_url: 'https://example.com/yoma.jpg', is_hidden: false,
};

for (const title of ['Yoma CLW Sideboard', 'Yoma CLW Cabinet', 'Yoma CLW (Details)']) {
  Deno.test(`unlinked ${title} is excluded even with complete metadata and a supplier image`, () => {
    assertEquals(isValidatedRecommendation({ ...consoleRecord, id: title, title, source: 'trade',
      source_pick_id: null, is_active: true }, canonicalIds), false);
  });
}
Deno.test('canonical Yoma console and its active linked Trade copy are valid', () => {
  assertEquals(isValidatedRecommendation(consoleRecord, canonicalIds), true);
  assertEquals(isValidatedRecommendation({ ...consoleRecord, id: 'trade-console', source: 'trade',
    source_pick_id: consoleRecord.id, is_active: true }, canonicalIds), true);
});
Deno.test('dangling or hidden-source Trade links cannot bypass canonical visibility', () => {
  assertEquals(isValidatedRecommendation({ ...consoleRecord, source: 'trade',
    source_pick_id: 'hidden-pick', is_active: true }, canonicalIds), false);
});
Deno.test('archived and incomplete records fail final readback validation', () => {
  assertEquals(isValidatedRecommendation({ ...consoleRecord, is_hidden: true }, canonicalIds), false);
  assertEquals(isValidatedRecommendation({ ...consoleRecord, source: 'trade',
    source_pick_id: consoleRecord.id, is_active: false }, canonicalIds), false);
  for (const field of ['title', 'brand', 'category', 'image_url'] as const) {
    assertEquals(isValidatedRecommendation({ ...consoleRecord, [field]: ' ' }, canonicalIds), false);
  }
});