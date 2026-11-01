/** Trade sourcing lead-time filter buckets. "≤ N Weeks" buckets are cumulative and use the
 * upper end of a quoted range (e.g. "12-14 weeks" counts as 14 weeks). */
export const LEAD_TIME_BUCKETS = ["Available Now", "≤ 6 Weeks", "≤ 10 Weeks", "≤ 14 Weeks", "≤ 18 Weeks", "20+ Weeks"] as const;

const LIMITS: [string, number][] = [["≤ 6 Weeks", 6], ["≤ 10 Weeks", 10], ["≤ 14 Weeks", 14], ["≤ 18 Weeks", 18]];

export function leadTimeMaxWeeks(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.toLowerCase().match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*(weeks?|wks?|months?)/);
  if (!m) return null;
  const n = Number(m[2] ?? m[1]);
  return m[3].startsWith("month") ? n * 4 : n;
}

export function leadTimeBuckets(text: string | null | undefined): string[] {
  if (!text) return [];
  if (/ready to ship|in stock|available now|immediate/i.test(text)) return ["Available Now", ...LIMITS.map(([l]) => l)];
  const weeks = leadTimeMaxWeeks(text);
  if (weeks == null) return [];
  const out = LIMITS.filter(([, max]) => weeks <= max).map(([l]) => l);
  if (weeks >= 20) out.push("20+ Weeks");
  return out;
}
