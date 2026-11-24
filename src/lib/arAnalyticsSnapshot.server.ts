import type { ArSnapshot } from './arAnalytics';

// Tool-queried published-app aggregates only. No collector credential or
// per-visit identifiers are stored. Replace with a freshly queried snapshot
// when the builder requests an update; this is explicitly not a live feed.
const zero = { launches: 0, opens: 0, unsupported: 0, failed: 0, visits: 0, fallback_visits: 0 };
export const arSnapshot: ArSnapshot = {
  from: '2026-11-17T10:03:04Z',
  to: '2026-11-24T10:03:04Z',
  totals: { all: { ...zero }, board: { ...zero }, 'viewing-room': { ...zero }, product: { ...zero } },
  days: [],
};