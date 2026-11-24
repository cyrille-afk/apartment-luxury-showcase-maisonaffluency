import { describe, expect, it } from 'vitest';
import { arDailySeries, fallbackRate, type ArCounts, type ArSnapshot } from './arAnalytics';
const counts: ArCounts = { launches: 8, opens: 3, unsupported: 2, failed: 1, visits: 10, fallback_visits: 3 };
describe('AR dashboard rate definitions', () => {
  it('includes unsupported visits rather than dividing displays by attempts', () => {
    expect(fallbackRate(counts)).toBe(30);
  });
  it('does not report zero percent without any observed visits', () => {
    expect(fallbackRate({ ...counts, visits: 0, fallback_visits: 0 })).toBeNull();
  });
  it('keeps surface-specific daily rates and missing days separate in Singapore time', () => {
    const snapshot: ArSnapshot = { from: '2026-11-23T18:00:00Z', to: '2026-11-24T18:00:00Z', totals: { all: counts, board: counts, 'viewing-room': counts, product: counts }, days: [{ ...counts, day: '2026-11-24', surface: 'board' }, { ...counts, launches: 99, day: '2026-11-24', surface: 'product' }] };
    expect(arDailySeries(snapshot, 'board')).toEqual([
      { day: '2026-11-24', label: '11-24', launches: 8, opens: 3, unsupported: 2, failed: 1, fallbackRate: 30 },
      { day: '2026-11-25', label: '11-25', launches: 0, opens: 0, unsupported: 0, failed: 0, fallbackRate: null },
    ]);
  });
});