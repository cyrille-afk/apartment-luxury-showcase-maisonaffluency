import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { browseComparisons } from './snapshotComparisonAnnotations';
const items = [
  { leftId: 'a', rightId: 'b', updatedAt: '2026-10-01T00:00:00Z', summary: 'oak', noteCount: 0, title: 'Zen vs Bold' },
  { leftId: 'c', rightId: 'd', updatedAt: '2026-10-10T00:00:00Z', summary: '', noteCount: 1, title: 'Alpha vs Beta' },
];
describe('browseComparisons', () => {
  it('sorts newest first by date', () => expect(browseComparisons(items, 'date', '').map(i => i.leftId)).toEqual(['c', 'a']));
  it('sorts A–Z by title', () => expect(browseComparisons(items, 'title', '').map(i => i.title)).toEqual(['Alpha vs Beta', 'Zen vs Bold']));
  it('filters by title or summary', () => { expect(browseComparisons(items, 'date', 'oak').map(i => i.leftId)).toEqual(['a']); expect(browseComparisons(items, 'date', 'alpha').map(i => i.leftId)).toEqual(['c']); });
});
