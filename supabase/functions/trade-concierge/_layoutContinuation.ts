/** A workflow continuation must not be reparsed as a fresh tearsheet brief. */
export function isLayoutScheduleContinuation(text: string, gateComplete: boolean): boolean {
  return gateComplete && /\[Layout selected\b|SELECTED LAYOUT:\s*Option\s+\d/i.test(text)
    && /propose_ffe_rows/.test(text);
}

function loose(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const LIGHTING_RE = /\b(lamps?|lighting|lights?|sconces?|chandeliers?|pendants?|lanterns?)\b/;

/** Item matchers for the specific pieces named on the brief's TYPOLOGY line. */
const ITEM_MATCHERS: Array<{ test: RegExp; match: RegExp; exclude?: RegExp }> = [
  { test: /\bstools?\b/, match: /\bstools?\b/ },
  { test: /\b(side|end|occasional)\s+tables?\b/, match: /\b(side|end|occasional)\s+tables?\b|\bgueridons?\b/, exclude: LIGHTING_RE },
  { test: /\bcoffee\s+tables?\b/, match: /\b(coffee|cocktail)\s+tables?\b/, exclude: LIGHTING_RE },
  { test: /\bdining\s+tables?\b/, match: /\bdining\s+tables?\b/, exclude: LIGHTING_RE },
  { test: /\bconsoles?\b/, match: /\bconsoles?\b/, exclude: LIGHTING_RE },
  { test: /\b(lounge|accent|club|easy)\s+chairs?\b|\barmchairs?\b|\bfauteuils?\b/, match: /\b(lounge|accent|club|easy)\s+chairs?\b|\barmchairs?\b|\bfauteuils?\b/ },
  { test: /\bdining\s+chairs?\b/, match: /\bdining\s+chairs?\b|\bchairs?\b/, exclude: /\b(arm|lounge|club|easy)\s*chairs?\b/ },
  { test: /\b(sofas?|settees?|sectionals?)\b/, match: /\b(sofas?|settees?|sectionals?|loveseats?)\b/ },
  { test: /\bbenche?s?\b/, match: /\bbench(es)?\b/ },
  { test: /\b(ottomans?|poufs?)\b/, match: /\b(ottomans?|poufs?)\b/ },
];

export type ScheduleItem = { label: string; match: RegExp; exclude?: RegExp };

/** Split "Bar stools, side tables, lounge chairs" into individually matchable pieces. */
export function parseScheduleItems(typologyField: string): ScheduleItem[] {
  const tokens = String(typologyField || "")
    .replace(/[\[\]]/g, "")
    .split(/,|;|\+|&|\/|\band\b/i)
    .map((token) => token.trim())
    .filter(Boolean);
  const items: ScheduleItem[] = [];
  for (const token of tokens) {
    const norm = loose(token);
    const matcher = ITEM_MATCHERS.find((m) => m.test.test(norm));
    if (!matcher) continue;
    if (items.some((item) => item.match === matcher.match)) continue;
    items.push({ label: token.toLowerCase(), match: matcher.match, exclude: matcher.exclude });
  }
  return items;
}

export function rowMatchesScheduleItem(row: { title?: string | null; product_name?: string | null; subcategory?: string | null; category?: string | null }, item: ScheduleItem): boolean {
  const title = loose(row.title ?? row.product_name);
  const hay = `${title} ${loose(row.subcategory)}`;
  if (item.exclude?.test(title)) return false;
  return item.match.test(hay);
}

/** Whether a row belongs to one of the brief's REFERENCES brands (by id or by name). */
export function rowInReferenceScope(
  row: { designer_id?: string | null; designer_name?: string | null; brand_name?: string | null },
  scopedIds: Set<string>,
  scopedNames: string[],
): boolean {
  if (row.designer_id && scopedIds.has(row.designer_id)) return true;
  const names = [row.designer_name, row.brand_name].map(loose).filter(Boolean);
  return names.some((name) => scopedNames.some((scoped) => scoped && (name === scoped || name.startsWith(`${scoped} `) || name.includes(` ${scoped}`))));
}

/**
 * Pick up to `perItem` rows for every named piece, round-robin across items so
 * each requested piece is represented. Returns the rows and any items with no
 * catalogue match (those must be reported, never silently substituted).
 */
export function selectScheduleRows<T extends { id?: string | null; title?: string | null; product_name?: string | null; subcategory?: string | null; category?: string | null }>(
  rows: T[],
  items: ScheduleItem[],
  perItem = 2,
): { rows: Array<T & { schedule_item: string }>; missing: string[] } {
  const used = new Set<string>();
  const buckets = items.map((item) => rows.filter((row) => rowMatchesScheduleItem(row, item)));
  const missing = items.filter((_, index) => buckets[index].length === 0).map((item) => item.label);
  const picked: Array<T & { schedule_item: string }> = [];
  for (let round = 0; round < perItem; round++) {
    buckets.forEach((bucket, index) => {
      const next = bucket.find((row) => row.id && !used.has(String(row.id)));
      if (!next) return;
      used.add(String(next.id));
      picked.push({ ...next, schedule_item: items[index].label });
    });
  }
  return { rows: picked, missing };
}
