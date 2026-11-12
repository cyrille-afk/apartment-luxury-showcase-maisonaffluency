import { assertEquals } from 'jsr:@std/assert';
import { groupCatalogueProducts, productIdentity } from './productIdentity.ts';

const angelo = { id: 'fd428db3-3407-4d60-9c8b-839c356cf10a', source: 'curator' as const, title: 'Angelo M/H High Table' };
const tradeAngelo = { id: 'f0dc6a25-fb8a-455b-b7a7-ea000ba36254', source: 'trade' as const, source_pick_id: angelo.id, title: angelo.title };

Deno.test('Angelo catalogue and linked Trade copies produce exactly one complement', () => {
  assertEquals(groupCatalogueProducts([tradeAngelo, angelo, tradeAngelo]), [angelo]);
});
Deno.test('a linked product already on the board cannot return as its other representation', () => {
  assertEquals(groupCatalogueProducts([angelo, tradeAngelo], new Set([productIdentity(tradeAngelo)])), []);
});
Deno.test('unlinked products remain distinct even with matching names', () => {
  const other = { ...tradeAngelo, source_pick_id: null };
  assertEquals(groupCatalogueProducts([angelo, other]).length, 2);
});