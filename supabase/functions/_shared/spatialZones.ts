// Spatial (room / zone) vocabulary baseline for the trade concierge.
//
// Fixes the semantic routing bug where an interior zone reply such as
// "Living and Dining room" was fed into the geographic city/hub resolver and
// answered with a freight-hub fallback ("… nearest primary hub is London").
//
// Two guards:
//   1. VOCABULARY — any message containing a standard architectural spatial
//      token is a zone answer, never a city assertion.
//   2. SEQUENCE   — if Felix's immediately preceding turn asked which rooms or
//      zones to prioritise, the user's next short reply is parsed as a zone.

export const SPATIAL_TOKENS: string[] = [
  "living room",
  "living and dining",
  "living",
  "dining room",
  "dining",
  "great room",
  "family room",
  "sitting room",
  "drawing room",
  "reception room",
  "lounge",
  "salon",
  "kitchen",
  "pantry",
  "scullery",
  "breakfast nook",
  "master bedroom",
  "primary bedroom",
  "principal bedroom",
  "guest bedroom",
  "guest room",
  "bedroom",
  "nursery",
  "dressing room",
  "walk-in closet",
  "walk in closet",
  "closet",
  "bathroom",
  "master bath",
  "ensuite",
  "en-suite",
  "powder room",
  "wc",
  "entry foyer",
  "foyer",
  "entrance hall",
  "entryway",
  "hallway",
  "corridor",
  "landing",
  "staircase",
  "study",
  "home office",
  "office",
  "library",
  "den",
  "media room",
  "cinema room",
  "screening room",
  "game room",
  "playroom",
  "gym",
  "wellness room",
  "spa",
  "wine cellar",
  "cellar",
  "bar",
  "terrace",
  "balcony",
  "veranda",
  "patio",
  "courtyard",
  "garden room",
  "conservatory",
  "sunroom",
  "poolhouse",
  "pool house",
  "outdoor lounge",
  "laundry room",
  "utility room",
  "mudroom",
  "garage",
  "attic",
  "basement",
  "loft space",
  "mezzanine",
  "lobby",
  "waiting area",
  "boardroom",
  "meeting room",
  "reception area",
  "suite",
  "penthouse floor",
];

// Tokens that would otherwise collide with real place names are matched only
// with a room-ish qualifier (handled by requiring the longer phrase above).
const AMBIGUOUS = new Set(["office", "spa", "bar", "suite", "living", "dining", "closet", "wc"]);

function norm(s: string): string {
  return (s || "").toLowerCase().replace(/[.,;:!?]/g, " ").replace(/\s+/g, " ").trim();
}

/** Every spatial token present in the message, in canonical form. */
export function extractZones(text: string): string[] {
  const t = norm(text);
  if (!t) return [];
  const hits: string[] = [];
  for (const token of SPATIAL_TOKENS) {
    const re = new RegExp(`(^|[^a-z])${token.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}([^a-z]|$)`, "i");
    if (!re.test(t)) continue;
    if (AMBIGUOUS.has(token) && !/\b(room|rooms|zone|zones|area|areas|space|spaces|and|&)\b/i.test(t)) continue;
    hits.push(token);
  }
  // Collapse overlapping matches: keep the longest phrase whenever two hits
  // share a word ("living and dining" wins over "living" and "dining room").
  const sorted = [...hits].sort((a, b) => b.length - a.length);
  const kept: string[] = [];
  for (const h of sorted) {
    const words = h.split(" ");
    const overlaps = kept.some((k) => k.split(" ").some((w) => words.includes(w)));
    if (!overlaps) kept.push(h);
  }
  return hits.filter((h) => kept.includes(h));
}

/** Does this message name an interior room/zone rather than a location? */
export function looksLikeSpatialZone(text: string): boolean {
  return extractZones(text).length > 0;
}

/**
 * Sequence-awareness: did Felix's previous turn explicitly ask which rooms or
 * zones the studio is prioritising? If so the next user turn is a zone answer,
 * even when it uses vocabulary the baseline list does not cover.
 */
export function assistantAskedForZone(text: string | null | undefined): boolean {
  const t = norm(text || "");
  if (!t) return false;
  return (
    /(which|what)\s+(rooms?|zones?|areas?|spaces?)/i.test(t) ||
    /not yet specified which rooms? or zones?/i.test(t) ||
    /rooms? or zones? (we are|are we|you are) prioriti/i.test(t) ||
    /(rooms?|zones?|areas?)\s+(are we|would you like to|do you want to)\s+prioriti/i.test(t)
  );
}

/** Title-case a zone list for the confirmation line. */
function display(zones: string[]): string {
  const pretty = zones.map((z) => z.replace(/\b\w/g, (c) => c.toUpperCase()));
  if (pretty.length <= 1) return pretty[0] || "";
  return `${pretty.slice(0, -1).join(", ")} and ${pretty[pretty.length - 1]}`;
}

/**
 * System note injected instead of the CITY LOCK note when the user's turn is a
 * room/zone answer. Forces the graceful recognition reply shape.
 */
export function buildZoneLockSystemNote(rawInput: string, zones: string[]): string {
  const label = zones.length ? display(zones) : rawInput.trim();
  return (
    `## ZONE LOCK — SPATIAL TYPOLOGY (NOT A LOCATION)\n` +
    `User typed: "${rawInput.trim()}"\n` +
    `Parsed as interior room / zone typology: ${label}\n` +
    `briefState.zone = [${zones.map((z) => `"${z}"`).join(", ") || `"${rawInput.trim()}"`}]\n\n` +
    `CRITICAL: This is an INTERIOR ZONE, not a city, port, country, or shipping destination. ` +
    `Do NOT run the geographic hub lookup on it. Do NOT say it "falls outside our standard concierge trade routes". ` +
    `Do NOT propose London / Dubai / Hong Kong or any other hub. Do NOT ask for the city again — the project location is already established earlier in this thread.\n\n` +
    `Confirm the zone in Felix's voice with this exact shape, one line, then move straight to configuring layouts:\n` +
    `"Understood. Prioritizing the ${label} layouts for our [project typology] project. Let's configure the exact layouts…"\n` +
    `Then continue the brief: scale/seating, existing architecture, or invite a room plan via the paperclip.`
  );
}
