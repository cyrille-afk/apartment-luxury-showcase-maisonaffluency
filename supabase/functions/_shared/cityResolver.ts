// City resolver for the trade concierge.
//
// Two-tier recovery for user-typed project locations:
//   • TIER 1 — silent typo/alias correction against a curated hub dictionary
//   • TIER 2 — obscure/unknown input falls back to the nearest primary hub
//              (using regional/country hints where possible)
//
// Optional silent geocoding: if a GOOGLE_MAPS_API_KEY connector secret is
// present, unknown inputs are geocoded through the Lovable gateway. When the
// geocoder returns a real place, we snap it to the nearest primary hub via
// the country/region tables below and mark the match as "geocoded". If the
// geocoder itself fails or nothing sensible comes back, we degrade to the
// dictionary/fallback path — Felix always gets a lock-in.

export type CityMatchType = "exact" | "alias" | "fuzzy" | "geocoded" | "fallback" | "unknown" | "gibberish";

export interface CityResolution {
  input: string;
  resolvedCity: string | null;   // canonical city name we locked in on
  hub: string;                    // primary logistics hub we route through
  region: "EMEA" | "APAC" | "Americas" | "Middle East" | "Global";
  country?: string;
  matchType: CityMatchType;
  rationale: string;              // one-line "why this hub" for TIER 2 / fallback
  alternatives: string[];         // 2 additional hubs to offer as override
}

// Primary hubs by region (ordered by weight — first is the fallback default).
const HUBS: Record<CityResolution["region"], string[]> = {
  EMEA: ["London", "Paris", "Milan"],
  APAC: ["Singapore", "Hong Kong", "Tokyo"],
  Americas: ["New York", "Miami", "Los Angeles"],
  "Middle East": ["Dubai", "Doha", "Riyadh"],
  Global: ["London", "Dubai", "Hong Kong"],
};

// Canonical cities → (hub, region, country). The hub is where logistics
// consolidate; the canonical city is what we tell the user we locked in on.
const CITY_HUB: Record<string, { hub: string; region: CityResolution["region"]; country: string }> = {
  // EMEA
  london: { hub: "London", region: "EMEA", country: "United Kingdom" },
  paris: { hub: "Paris", region: "EMEA", country: "France" },
  milan: { hub: "Milan", region: "EMEA", country: "Italy" },
  rome: { hub: "Milan", region: "EMEA", country: "Italy" },
  florence: { hub: "Milan", region: "EMEA", country: "Italy" },
  venice: { hub: "Milan", region: "EMEA", country: "Italy" },
  madrid: { hub: "Paris", region: "EMEA", country: "Spain" },
  barcelona: { hub: "Paris", region: "EMEA", country: "Spain" },
  lisbon: { hub: "Paris", region: "EMEA", country: "Portugal" },
  berlin: { hub: "Paris", region: "EMEA", country: "Germany" },
  munich: { hub: "Milan", region: "EMEA", country: "Germany" },
  frankfurt: { hub: "Paris", region: "EMEA", country: "Germany" },
  hamburg: { hub: "Paris", region: "EMEA", country: "Germany" },
  vienna: { hub: "Milan", region: "EMEA", country: "Austria" },
  zurich: { hub: "Milan", region: "EMEA", country: "Switzerland" },
  geneva: { hub: "Paris", region: "EMEA", country: "Switzerland" },
  amsterdam: { hub: "Paris", region: "EMEA", country: "Netherlands" },
  brussels: { hub: "Paris", region: "EMEA", country: "Belgium" },
  monaco: { hub: "Paris", region: "EMEA", country: "Monaco" },
  "monte carlo": { hub: "Paris", region: "EMEA", country: "Monaco" },
  cannes: { hub: "Paris", region: "EMEA", country: "France" },
  nice: { hub: "Paris", region: "EMEA", country: "France" },
  "st tropez": { hub: "Paris", region: "EMEA", country: "France" },
  athens: { hub: "Milan", region: "EMEA", country: "Greece" },
  istanbul: { hub: "London", region: "EMEA", country: "Turkey" },
  moscow: { hub: "London", region: "EMEA", country: "Russia" },
  dublin: { hub: "London", region: "EMEA", country: "Ireland" },
  edinburgh: { hub: "London", region: "EMEA", country: "United Kingdom" },
  manchester: { hub: "London", region: "EMEA", country: "United Kingdom" },
  stockholm: { hub: "London", region: "EMEA", country: "Sweden" },
  copenhagen: { hub: "London", region: "EMEA", country: "Denmark" },
  oslo: { hub: "London", region: "EMEA", country: "Norway" },

  // Middle East
  dubai: { hub: "Dubai", region: "Middle East", country: "United Arab Emirates" },
  "abu dhabi": { hub: "Dubai", region: "Middle East", country: "United Arab Emirates" },
  doha: { hub: "Doha", region: "Middle East", country: "Qatar" },
  riyadh: { hub: "Riyadh", region: "Middle East", country: "Saudi Arabia" },
  jeddah: { hub: "Riyadh", region: "Middle East", country: "Saudi Arabia" },
  kuwait: { hub: "Dubai", region: "Middle East", country: "Kuwait" },
  "kuwait city": { hub: "Dubai", region: "Middle East", country: "Kuwait" },
  manama: { hub: "Dubai", region: "Middle East", country: "Bahrain" },
  muscat: { hub: "Dubai", region: "Middle East", country: "Oman" },
  "tel aviv": { hub: "Dubai", region: "Middle East", country: "Israel" },
  beirut: { hub: "Dubai", region: "Middle East", country: "Lebanon" },

  // APAC
  singapore: { hub: "Singapore", region: "APAC", country: "Singapore" },
  "hong kong": { hub: "Hong Kong", region: "APAC", country: "Hong Kong" },
  shanghai: { hub: "Hong Kong", region: "APAC", country: "China" },
  beijing: { hub: "Hong Kong", region: "APAC", country: "China" },
  shenzhen: { hub: "Hong Kong", region: "APAC", country: "China" },
  guangzhou: { hub: "Hong Kong", region: "APAC", country: "China" },
  taipei: { hub: "Hong Kong", region: "APAC", country: "Taiwan" },
  tokyo: { hub: "Tokyo", region: "APAC", country: "Japan" },
  osaka: { hub: "Tokyo", region: "APAC", country: "Japan" },
  kyoto: { hub: "Tokyo", region: "APAC", country: "Japan" },
  seoul: { hub: "Tokyo", region: "APAC", country: "South Korea" },
  bangkok: { hub: "Singapore", region: "APAC", country: "Thailand" },
  jakarta: { hub: "Singapore", region: "APAC", country: "Indonesia" },
  "kuala lumpur": { hub: "Singapore", region: "APAC", country: "Malaysia" },
  manila: { hub: "Singapore", region: "APAC", country: "Philippines" },
  "ho chi minh city": { hub: "Singapore", region: "APAC", country: "Vietnam" },
  hanoi: { hub: "Singapore", region: "APAC", country: "Vietnam" },
  mumbai: { hub: "Dubai", region: "APAC", country: "India" },
  "new delhi": { hub: "Dubai", region: "APAC", country: "India" },
  delhi: { hub: "Dubai", region: "APAC", country: "India" },
  bengaluru: { hub: "Dubai", region: "APAC", country: "India" },
  bangalore: { hub: "Dubai", region: "APAC", country: "India" },
  sydney: { hub: "Singapore", region: "APAC", country: "Australia" },
  melbourne: { hub: "Singapore", region: "APAC", country: "Australia" },
  auckland: { hub: "Singapore", region: "APAC", country: "New Zealand" },

  // Americas
  "new york": { hub: "New York", region: "Americas", country: "United States" },
  "new york city": { hub: "New York", region: "Americas", country: "United States" },
  nyc: { hub: "New York", region: "Americas", country: "United States" },
  manhattan: { hub: "New York", region: "Americas", country: "United States" },
  brooklyn: { hub: "New York", region: "Americas", country: "United States" },
  hamptons: { hub: "New York", region: "Americas", country: "United States" },
  greenwich: { hub: "New York", region: "Americas", country: "United States" },
  boston: { hub: "New York", region: "Americas", country: "United States" },
  philadelphia: { hub: "New York", region: "Americas", country: "United States" },
  washington: { hub: "New York", region: "Americas", country: "United States" },
  "washington dc": { hub: "New York", region: "Americas", country: "United States" },
  miami: { hub: "Miami", region: "Americas", country: "United States" },
  "miami beach": { hub: "Miami", region: "Americas", country: "United States" },
  "palm beach": { hub: "Miami", region: "Americas", country: "United States" },
  naples: { hub: "Miami", region: "Americas", country: "United States" },
  atlanta: { hub: "Miami", region: "Americas", country: "United States" },
  dallas: { hub: "Miami", region: "Americas", country: "United States" },
  houston: { hub: "Miami", region: "Americas", country: "United States" },
  austin: { hub: "Miami", region: "Americas", country: "United States" },
  "los angeles": { hub: "Los Angeles", region: "Americas", country: "United States" },
  la: { hub: "Los Angeles", region: "Americas", country: "United States" },
  "beverly hills": { hub: "Los Angeles", region: "Americas", country: "United States" },
  "bel air": { hub: "Los Angeles", region: "Americas", country: "United States" },
  malibu: { hub: "Los Angeles", region: "Americas", country: "United States" },
  "san francisco": { hub: "Los Angeles", region: "Americas", country: "United States" },
  seattle: { hub: "Los Angeles", region: "Americas", country: "United States" },
  aspen: { hub: "Los Angeles", region: "Americas", country: "United States" },
  chicago: { hub: "New York", region: "Americas", country: "United States" },
  toronto: { hub: "New York", region: "Americas", country: "Canada" },
  vancouver: { hub: "Los Angeles", region: "Americas", country: "Canada" },
  montreal: { hub: "New York", region: "Americas", country: "Canada" },
  "mexico city": { hub: "Miami", region: "Americas", country: "Mexico" },
  cabo: { hub: "Los Angeles", region: "Americas", country: "Mexico" },
  "sao paulo": { hub: "Miami", region: "Americas", country: "Brazil" },
  "rio de janeiro": { hub: "Miami", region: "Americas", country: "Brazil" },
  "buenos aires": { hub: "Miami", region: "Americas", country: "Argentina" },
};

// Common aliases and abbreviations resolve straight to a canonical key above.
const ALIASES: Record<string, string> = {
  sg: "singapore",
  sgp: "singapore",
  hk: "hong kong",
  hkg: "hong kong",
  bkk: "bangkok",
  ldn: "london",
  lon: "london",
  cdg: "paris",
  par: "paris",
  nyc: "new york",
  ny: "new york",
  la: "los angeles",
  lax: "los angeles",
  sf: "san francisco",
  sfo: "san francisco",
  dxb: "dubai",
  auh: "abu dhabi",
  doh: "doha",
  ruh: "riyadh",
  hnd: "tokyo",
  nrt: "tokyo",
  pek: "beijing",
  pvg: "shanghai",
  syd: "sydney",
  mel: "melbourne",
  mia: "miami",
  yyz: "toronto",
  yvr: "vancouver",
};

// Country / region hints for TIER 2 fallback (when the exact city isn't in the
// dictionary but the user gave a state, country, or broader region).
const COUNTRY_HINTS: Array<{ needle: RegExp; region: CityResolution["region"]; hub: string; country: string }> = [
  { needle: /\b(new jersey|nj|connecticut|ct|long island|westchester|upstate new york|pennsylvania|pa)\b/i, region: "Americas", hub: "New York", country: "United States" },
  { needle: /\b(florida|fl|bahamas|caribbean|puerto rico)\b/i, region: "Americas", hub: "Miami", country: "United States" },
  { needle: /\b(california|ca|nevada|nv|arizona|az|oregon|or)\b/i, region: "Americas", hub: "Los Angeles", country: "United States" },
  { needle: /\b(united states|usa|u\.s\.a?\.?|america)\b/i, region: "Americas", hub: "New York", country: "United States" },
  { needle: /\b(canada|ontario|quebec|british columbia)\b/i, region: "Americas", hub: "New York", country: "Canada" },
  { needle: /\b(mexico|brazil|argentina|chile|colombia|peru)\b/i, region: "Americas", hub: "Miami", country: "" },
  { needle: /\b(united kingdom|uk|england|scotland|wales|ireland)\b/i, region: "EMEA", hub: "London", country: "United Kingdom" },
  { needle: /\b(france|french riviera|cote d'azur|côte d'azur|provence)\b/i, region: "EMEA", hub: "Paris", country: "France" },
  { needle: /\b(italy|tuscany|sicily|sardinia|lake como|amalfi)\b/i, region: "EMEA", hub: "Milan", country: "Italy" },
  { needle: /\b(spain|portugal|balearic|ibiza|mallorca)\b/i, region: "EMEA", hub: "Paris", country: "" },
  { needle: /\b(germany|austria|switzerland|belgium|netherlands|luxembourg)\b/i, region: "EMEA", hub: "Paris", country: "" },
  { needle: /\b(scandinavia|sweden|norway|denmark|finland|iceland)\b/i, region: "EMEA", hub: "London", country: "" },
  { needle: /\b(greece|cyprus|malta|turkey|israel|lebanon)\b/i, region: "EMEA", hub: "London", country: "" },
  { needle: /\b(uae|emirates|abu dhabi|sharjah|ajman|fujairah)\b/i, region: "Middle East", hub: "Dubai", country: "United Arab Emirates" },
  { needle: /\b(qatar|bahrain|oman|kuwait|saudi arabia|ksa)\b/i, region: "Middle East", hub: "Dubai", country: "" },
  { needle: /\b(china|prc|mainland china)\b/i, region: "APAC", hub: "Hong Kong", country: "China" },
  { needle: /\b(japan|korea|south korea)\b/i, region: "APAC", hub: "Tokyo", country: "" },
  { needle: /\b(singapore|malaysia|indonesia|thailand|vietnam|philippines)\b/i, region: "APAC", hub: "Singapore", country: "" },
  { needle: /\b(india|pakistan|sri lanka|bangladesh)\b/i, region: "APAC", hub: "Dubai", country: "" },
  { needle: /\b(australia|new zealand|nz|oceania|pacific)\b/i, region: "APAC", hub: "Singapore", country: "" },
  { needle: /\b(africa|south africa|nigeria|kenya|morocco|egypt)\b/i, region: "EMEA", hub: "Dubai", country: "" },
];

const HUB_RATIONALES: Record<string, string> = {
  London: "closest EMEA freight gateway with weekly white-glove consolidations",
  Paris: "primary Continental European trade hub with direct atelier corridors",
  Milan: "Italian atelier consolidation point and Mediterranean freight anchor",
  Dubai: "Middle East white-glove gateway with weekly departures to South Asia and Africa",
  Doha: "Gulf freight anchor with direct consolidations for Qatar-region projects",
  Riyadh: "primary Saudi customs corridor for Kingdom-based projects",
  "New York": "Eastern-seaboard white-glove hub for the US Northeast and Canada",
  Miami: "Southeast-US and Latin America consolidation gateway",
  "Los Angeles": "West-coast white-glove hub covering California, Nevada, and the Pacific",
  Singapore: "APAC white-glove hub for Southeast Asia and Oceania",
  "Hong Kong": "Greater China freight gateway with direct atelier corridors",
  Tokyo: "North-Asia white-glove hub for Japan and Korea",
};

function norm(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[.,'’]/g, "").replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[j], dp[j - 1]) + 1;
      prev = tmp;
    }
  }
  return dp[b.length];
}

function pickAlternatives(region: CityResolution["region"], primary: string): string[] {
  const pool = HUBS[region] || HUBS.Global;
  return pool.filter((h) => h !== primary).slice(0, 2);
}

function makeResolution(canonical: string, entry: { hub: string; region: CityResolution["region"]; country: string }, matchType: CityMatchType, input: string): CityResolution {
  const display = canonical.replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    input,
    resolvedCity: matchType === "fallback" || matchType === "unknown" ? null : display,
    hub: entry.hub,
    region: entry.region,
    country: entry.country || undefined,
    matchType,
    rationale: HUB_RATIONALES[entry.hub] || "closest primary trade hub for your region",
    alternatives: pickAlternatives(entry.region, entry.hub),
  };
}

async function geocodeViaGateway(input: string): Promise<{ country?: string; region?: CityResolution["region"]; hub?: string; city?: string } | null> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const gmapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!lovableKey || !gmapsKey) return null;
  try {
    const url = `https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json?address=${encodeURIComponent(input)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": gmapsKey },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const first = json?.results?.[0];
    if (!first) return null;
    const comps: Array<{ long_name: string; short_name: string; types: string[] }> = first.address_components || [];
    const country = comps.find((c) => c.types.includes("country"))?.long_name;
    const locality = comps.find((c) => c.types.some((t) => ["locality", "postal_town", "administrative_area_level_2", "administrative_area_level_1"].includes(t)))?.long_name;
    // Route by country to region/hub.
    const hint = COUNTRY_HINTS.find((h) => country && h.needle.test(country));
    if (hint) {
      return { country, region: hint.region, hub: hint.hub, city: locality };
    }
    return { country, city: locality };
  } catch {
    return null;
  }
}

/**
 * Resolve a user-typed project location into a canonical city + logistics hub.
 * Runs the dictionary + fuzzy path first (instant, no external call); only
 * falls through to silent Google Maps geocoding for genuinely unknown input.
 */
/**
 * Detect obvious gibberish/keyboard-mash so we don't fabricate a freight hub
 * for it. Runs BEFORE the dictionary/fuzzy path so that inputs like
 * "asdfg123", "qwerty", "xxxxx" are flagged and Felix asks for clarification
 * instead of guessing London/EMEA. This is deliberately conservative — real
 * short city names (NYC, LA, HK) and typo'd cities still resolve normally.
 */
export function looksLikeGibberish(rawInput: string): boolean {
  const raw = (rawInput || "").trim();
  if (!raw) return false;
  const t = raw.toLowerCase();
  // Contains digits mixed into a single alphanumeric token → not a city.
  if (/^[a-z0-9]+$/i.test(t) && /\d/.test(t) && /[a-z]/i.test(t)) return true;
  // Pure digits.
  if (/^\d+$/.test(t)) return true;
  // Long single unbroken alphabetic string with no vowels (e.g. "xckdfgh") —
  // real city names virtually always contain at least one vowel.
  if (/^[a-z]{5,}$/i.test(t) && !/[aeiouy]/i.test(t)) return true;
  // Common keyboard-mash rows.
  const KEYBOARD_ROWS = ["qwerty", "asdfgh", "zxcvbn", "qwertyui", "asdfghjkl", "zxcvbnm"];
  if (KEYBOARD_ROWS.some((row) => t.startsWith(row.slice(0, Math.min(row.length, t.length))) && t.length >= 5)) return true;
  // Same character repeated 4+ times ("xxxxx", "aaaa1").
  if (/^(.)\1{3,}$/i.test(t.replace(/\d+$/, ""))) return true;
  return false;
}

export async function resolveProjectCity(rawInput: string): Promise<CityResolution> {
  const input = (rawInput || "").trim();
  const key = norm(input);
  if (!key) {
    const hub = "London";
    return {
      input,
      resolvedCity: null,
      hub,
      region: "Global",
      matchType: "unknown",
      rationale: HUB_RATIONALES[hub],
      alternatives: pickAlternatives("Global", hub),
    };
  }

  // 0) Gibberish / keyboard-mash guard — refuse to invent a hub for this.
  if (looksLikeGibberish(input)) {
    return {
      input,
      resolvedCity: null,
      hub: "",
      region: "Global",
      matchType: "gibberish",
      rationale: "input could not be mapped to a real location",
      alternatives: [],
    };
  }

  // 1) Exact hit against the canonical dictionary.
  if (CITY_HUB[key]) return makeResolution(key, CITY_HUB[key], "exact", input);

  // 2) Alias / airport-code / abbreviation.
  if (ALIASES[key] && CITY_HUB[ALIASES[key]]) return makeResolution(ALIASES[key], CITY_HUB[ALIASES[key]], "alias", input);

  // 3) Substring — user typed "London, UK" or "Dubai Marina".
  for (const canonical of Object.keys(CITY_HUB)) {
    if (canonical.length >= 4 && key.includes(canonical)) {
      return makeResolution(canonical, CITY_HUB[canonical], "exact", input);
    }
  }

  // 4) Fuzzy typo match against the dictionary.
  let best: { canonical: string; dist: number } | null = null;
  for (const canonical of Object.keys(CITY_HUB)) {
    const dist = levenshtein(key, canonical);
    const max = canonical.length <= 5 ? 1 : canonical.length <= 8 ? 2 : 3;
    if (dist <= max && (!best || dist < best.dist)) best = { canonical, dist };
  }
  if (best) return makeResolution(best.canonical, CITY_HUB[best.canonical], "fuzzy", input);

  // 5) Country / region hint from the free-text input.
  const hint = COUNTRY_HINTS.find((h) => h.needle.test(input));
  if (hint) {
    return {
      input,
      resolvedCity: null,
      hub: hint.hub,
      region: hint.region,
      country: hint.country || undefined,
      matchType: "fallback",
      rationale: HUB_RATIONALES[hint.hub] || "closest primary trade hub for your region",
      alternatives: pickAlternatives(hint.region, hint.hub),
    };
  }

  // 6) Silent geocoding — only if the connector secret is present.
  const geo = await geocodeViaGateway(input);
  if (geo && geo.hub && geo.region) {
    // Prefer snapping the returned locality to a known canonical dictionary
    // entry so the user sees a real city name they recognise.
    const geoKey = geo.city ? norm(geo.city) : "";
    if (geoKey && CITY_HUB[geoKey]) return makeResolution(geoKey, CITY_HUB[geoKey], "geocoded", input);
    return {
      input,
      resolvedCity: geo.city || null,
      hub: geo.hub,
      region: geo.region,
      country: geo.country,
      matchType: "geocoded",
      rationale: HUB_RATIONALES[geo.hub] || "closest primary trade hub based on geocoded location",
      alternatives: pickAlternatives(geo.region, geo.hub),
    };
  }

  // 7) Truly unknown — offer the three global hubs.
  return {
    input,
    resolvedCity: null,
    hub: "London",
    region: "Global",
    matchType: "unknown",
    rationale: HUB_RATIONALES.London,
    alternatives: pickAlternatives("Global", "London"),
  };
}

/**
 * Heuristic: does this user message look like a project-location assertion?
 * Used so we only run the resolver on plausible city turns instead of every
 * message. Fires when (a) message is short (≤ ~60 chars) and mostly a place
 * phrase, or (b) explicitly frames a location ("project in …", "based in …").
 */
export function looksLikeCityAssertion(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  if (t.length > 120) return false;
  if (/\b(project (is )?in|based in|located in|our project (is )?in|city[:\s]|location[:\s])\b/i.test(t)) return true;
  // Short, no sentence punctuation, no digits, few words → probably a city.
  const wordCount = t.split(/\s+/).length;
  if (wordCount <= 4 && !/[.!?]/.test(t) && !/\d/.test(t)) return true;
  return false;
}

/**
 * Build the system-note lock-in that we prepend to the LLM call. Felix reads
 * this and produces the elite TIER 1 / TIER 2 confirmation without ever
 * saying "city not found".
 */
export function buildCityLockSystemNote(r: CityResolution): string {
  const alt = r.alternatives.length ? r.alternatives.join(" / ") : "London / Dubai / Hong Kong";
  if (r.matchType === "exact" || r.matchType === "alias" || r.matchType === "fuzzy" || r.matchType === "geocoded") {
    const src = r.matchType === "fuzzy" ? "typo silently corrected" : r.matchType === "geocoded" ? "resolved via silent geocoding" : "matched directly";
    return (
      `## CITY LOCK — INTERNAL ROUTING (do not narrate the mechanism)\n` +
      `User typed: "${r.input}"\n` +
      `Resolved city: ${r.resolvedCity}\n` +
      `Primary logistics hub: ${r.hub} (${r.region}${r.country ? `, ${r.country}` : ""})\n` +
      `Match: ${src}\n\n` +
      `Respond with ONE elite TIER 1 confirmation line in Felix's voice, e.g. ` +
      `"I have mapped your project to ${r.resolvedCity} and locked in your regional trade multipliers and white-glove routes via our ${r.hub} hub." ` +
      `Do NOT surface the misspelling, do NOT ask the user to re-type the city, then proceed to the next contextual step (invite the piece, mood, or brief).`
    );
  }
  if (r.matchType === "fallback") {
    return (
      `## CITY LOCK — TIER 2 FALLBACK (regional hint)\n` +
      `User typed: "${r.input}" — not in the primary city index but region inferred.\n` +
      `Suggested primary hub: ${r.hub} (${r.region}) — ${r.rationale}.\n` +
      `Offer alternatives: ${alt}.\n\n` +
      `Reply in Felix's voice with the TIER 2 shape: acknowledge without judgement, propose ${r.hub} with the one-line "why this hub" reason, and explicitly invite an override with ${alt} or any other city. Never say "city not found".`
    );
  }
  // unknown
  return (
    `## CITY LOCK — TIER 2 FALLBACK (unrecognised)\n` +
    `User typed: "${r.input}" — genuinely unrecognised or too obscure to map.\n` +
    `Default suggested hub: ${r.hub} — ${r.rationale}.\n` +
    `Offer alternatives: ${alt}.\n\n` +
    `Reply in Felix's voice with the TIER 2 shape: acknowledge without judgement, propose ${r.hub} with a one-line "why this hub" reason (proximity, customs corridor, or established white-glove route), and explicitly invite an override with ${alt} or any other city they name. Never say "city not found" or surface any technical error.`
  );
}
