export type ArSurface = 'all' | 'board' | 'viewing-room' | 'product';
export interface ArCounts {
  launches: number;
  opens: number;
  unsupported: number;
  failed: number;
  visits: number;
  fallback_visits: number;
}
export interface ArDay extends ArCounts { day: string; surface: ArSurface }
export interface ArSnapshot {
  from: string;
  to: string;
  totals: Record<ArSurface, ArCounts>;
  days: ArDay[];
}
// Unique visits must be queried for the entire chosen scope, never summed
// across days or surfaces (a single visit can appear in several buckets).
export function fallbackRate(counts: ArCounts): number | null {
  return counts.visits > 0 ? counts.fallback_visits / counts.visits * 100 : null;
}
export function arDailySeries(snapshot: ArSnapshot, surface: ArSurface) {
  const first = new Date(snapshot.from);
  const last = new Date(snapshot.to);
  const dayKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  const endKey = dayKey(last);
  const series = [];
  for (let cursor = first; dayKey(cursor) <= endKey; cursor = new Date(cursor.getTime() + 86400000)) {
    const day = dayKey(cursor);
    const row = snapshot.days.find(r => r.day === day && r.surface === surface);
    series.push({ day, label: day.slice(5), launches: row?.launches ?? 0, opens: row?.opens ?? 0, unsupported: row?.unsupported ?? 0, failed: row?.failed ?? 0, fallbackRate: row ? fallbackRate(row) : null });
  }
  return series;
}