/**
 * Guardrail 3 — Semantic sanity-check filter (pre-render).
 *
 * Felix's freight/hub routing language must never appear in response to an
 * interior room or zone answer. Even with the server-side ZONE LOCK guards
 * (supabase/functions/_shared/spatialZones.ts), a model turn can still drift
 * into "nearest primary hub is London …". This filter runs in the browser
 * BEFORE the dialogue bubble renders: if the reply carries shipping-routing
 * data while the user's own text was not plausibly a city, the reply is
 * discarded and replaced with a zone-acknowledgement fallback.
 */

/** Guardrail 2 — absolute, un-bypassable architectural room vocabulary. */
export const ROOM_TOKENS: string[] = [
  "living room",
  "living and dining",
  "dining room",
  "bedroom",
  "master bedroom",
  "guest bedroom",
  "kitchen",
  "foyer",
  "entry foyer",
  "lounge",
  "study",
  "bathroom",
  "powder room",
  "dressing room",
  "walk-in closet",
  "home office",
  "library",
  "den",
  "media room",
  "playroom",
  "nursery",
  "pantry",
  "hallway",
  "terrace",
  "balcony",
  "courtyard",
  "laundry room",
  "utility room",
  "mudroom",
  "garage",
  "basement",
  "attic",
  "mezzanine",
  "salon",
  "sitting room",
  "drawing room",
  "family room",
  "great room",
  "reception room",
  "wine cellar",
  "gym",
  "spa room",
  "guest suite",
];

/** Shipping / freight-routing phrases that must never answer a zone reply. */
const SHIPPING_MARKERS: RegExp[] = [
  /falls outside our standard concierge trade routes/i,
  /nearest primary hub/i,
  /freight gateway/i,
  /freight hub/i,
  /route through (the )?closest match/i,
  /closest (emea|apac|amer|americas) (freight )?gateway/i,
  /white[- ]glove consolidations/i,
  /shipping (hub|multiplier|zone)/i,
  /maritime|port of (entry|discharge)/i,
];

/**
 * Compact global city baseline used only for the "is this plausibly a place?"
 * similarity test. Not a routing table — the edge function owns real hub
 * resolution; this list exists so the filter never discards a legitimate
 * logistics answer to a legitimate location.
 */
const CITY_NAMES: string[] = [
  "london", "paris", "milan", "rome", "madrid", "barcelona", "lisbon", "porto",
  "amsterdam", "rotterdam", "brussels", "antwerp", "luxembourg", "zurich",
  "geneva", "basel", "bern", "lugano", "vienna", "munich", "berlin", "hamburg",
  "frankfurt", "dusseldorf", "cologne", "copenhagen", "stockholm", "oslo",
  "helsinki", "dublin", "edinburgh", "manchester", "athens", "istanbul",
  "warsaw", "prague", "budapest", "monaco", "cannes", "nice", "marseille",
  "lyon", "bordeaux", "saint tropez", "ibiza", "mallorca", "marbella",
  "new york", "brooklyn", "manhattan", "hamptons", "greenwich", "boston",
  "washington", "philadelphia", "atlanta", "miami", "palm beach", "naples",
  "chicago", "dallas", "houston", "austin", "denver", "aspen", "scottsdale",
  "phoenix", "las vegas", "los angeles", "beverly hills", "malibu",
  "san francisco", "seattle", "portland", "san diego", "toronto", "vancouver",
  "montreal", "mexico city", "monterrey", "sao paulo", "rio de janeiro",
  "buenos aires", "santiago", "bogota", "lima", "panama city",
  "dubai", "abu dhabi", "sharjah", "doha", "riyadh", "jeddah", "kuwait city",
  "manama", "muscat", "amman", "beirut", "cairo", "tel aviv", "casablanca",
  "marrakech", "marrakesh", "johannesburg", "cape town", "lagos", "nairobi",
  "singapore", "hong kong", "macau", "shanghai", "beijing", "shenzhen",
  "guangzhou", "taipei", "seoul", "tokyo", "osaka", "kyoto", "bangkok",
  "phuket", "kuala lumpur", "jakarta", "bali", "manila", "ho chi minh city",
  "hanoi", "mumbai", "delhi", "new delhi", "bangalore", "chennai", "colombo",
  "male", "sydney", "melbourne", "brisbane", "perth", "auckland", "wellington",
];

function norm(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/** 0..1 — best similarity between the user's phrase and any known city name. */
export function cityNameSimilarity(text: string): number {
  const t = norm(text);
  if (!t) return 0;
  const candidates = new Set<string>([t]);
  // Also test the trailing 1–3 word window ("project is in marrakech").
  const words = t.split(" ");
  for (let n = 1; n <= 3; n++) {
    if (words.length >= n) candidates.add(words.slice(-n).join(" "));
  }
  let best = 0;
  for (const city of CITY_NAMES) {
    for (const cand of candidates) {
      if (cand.includes(city) || city.includes(cand)) return 1;
      const dist = levenshtein(cand, city);
      const score = 1 - dist / Math.max(cand.length, city.length);
      if (score > best) best = score;
    }
  }
  return best;
}

/** Does the user's text name an interior room / zone? */
export function containsRoomToken(text: string): boolean {
  const t = norm(text);
  if (!t) return false;
  return ROOM_TOKENS.some((token) =>
    new RegExp(`(^|[^a-z])${token.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}([^a-z]|$)`).test(t),
  );
}

function prettyZone(text: string): string {
  const raw = (text || "").trim().replace(/\s+/g, " ");
  const SMALL = new Set(["and", "or", "in", "of", "the"]);
  return raw
    .split(" ")
    .map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.replace(/^\w/, (c) => c.toUpperCase())))
    .join(" ");
}

export type FelixLogicVerdict = {
  /** False when the proposed reply was discarded. */
  ok: boolean;
  /** The text safe to render (original, or the zone fallback). */
  response: string;
  reason?: "shipping-answer-to-zone";
};

/**
 * Pre-render guard. `userText` is the message that produced `response`.
 * A shipping/hub reply survives only when the user's phrase is at least 50%
 * similar to a real city name and is not an architectural room token.
 */
export function validateFelixLogic(
  response: string,
  userText: string,
): FelixLogicVerdict {
  const text = response || "";
  if (!text.trim()) return { ok: true, response: text };
  const mentionsShipping = SHIPPING_MARKERS.some((re) => re.test(text));
  if (!mentionsShipping) return { ok: true, response: text };

  const isRoom = containsRoomToken(userText);
  const cityLike = !isRoom && cityNameSimilarity(userText) >= 0.5;
  if (cityLike) return { ok: true, response: text };

  return {
    ok: false,
    reason: "shipping-answer-to-zone",
    response: `Understood. Let's catalog your design ideas for the ${prettyZone(userText) || "specified"} zone.`,
  };
}
