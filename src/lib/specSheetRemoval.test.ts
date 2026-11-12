import { describe, expect, it } from 'vitest';
import { retainedSpecItems, specRemovalKey } from './specSheetRemoval';
describe('spec sheet removal', () => {
  it('removes only the chosen duplicate without changing the other row or quantity', () => {
    const items = [{ item_id: 'first', quantity: 2 }, { item_id: 'duplicate', quantity: 1 }];
    expect(retainedSpecItems(items, ['duplicate'])).toEqual([{ item_id: 'first', quantity: 2 }]);
    expect(items).toHaveLength(2);
  });
  it('isolates saved removals by account and project', () => {
    expect(specRemovalKey('a', 'p')).not.toBe(specRemovalKey('b', 'p'));
    expect(specRemovalKey('a', 'p')).not.toBe(specRemovalKey('a', 'q'));
  });
});