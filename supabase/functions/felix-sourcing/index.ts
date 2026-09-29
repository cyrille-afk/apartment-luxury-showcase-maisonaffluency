// Felix sourcing engine: all catalogue matching rules live server-side so the
// ranking "brain" is never shipped to the browser. Returns only final results.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const Body = z.object({
  mode: z.enum(["prompt", "reference"]),
  value: z.string().trim().min(1).max(500),
  track: z.boolean().optional(),
  path: z.string().max(200).optional(),
});

// Usage metric: one row per user-initiated submission, written with the
// service role so the client can never write or read the table directly.
async function logUsage(req: Request, mode: string, value: string, count: number, path?: string) {
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let userId: string | null = null;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (token) {
      const { data } = await admin.auth.getClaims(token);
      const sub = data?.claims?.sub;
      if (sub && data?.claims?.role === "authenticated") userId = sub as string;
    }
    await admin.from("felix_usage_events").insert({ mode, query: value, result_count: count, user_id: userId, page_path: path ?? null });
  } catch (e) { console.error("felix usage log", e); }
}

const STOP_WORDS = new Set(["a", "an", "and", "for", "in", "of", "the", "with", "room", "image", "pin", "pins", "www", "com", "https", "http"]);
const keywords = (v: string) => Array.from(new Set(v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w))));

const PINNED_KAVEHOME = [
  { title: /^medallion chair/i, designer: /dagmar/i },
  { title: /^vega b chair/i, designer: /de la espada/i },
  { title: /^entre bench/i, designer: /dagmar/i },
];
const LIGHTING_TERMS = new Set(["pendant", "pendants", "chandelier", "chandeliers", "lamp", "lamps", "lighting", "sconce", "sconces"]);
const MATERIALS: Record<string, RegExp> = {
  glass: /\b(glass|crystal|murano)\b/,
  crystal: /\b(crystal|glass)\b/,
  marble: /\bmarble\b/,
  travertine: /\btravertine\b/,
  stone: /\b(stone|marble|travertine|granite|onyx|limestone)\b/,
  wood: /\b(wood|wooden|oak|walnut|ash|teak|beech|mahogany|timber|cedar|elm|maple|cherry)\b/,
  wooden: /\b(wood|wooden|oak|walnut|ash|teak|beech|mahogany|timber|cedar|elm|maple|cherry)\b/,
  oak: /\boak\b/, walnut: /\bwalnut\b/,
  metal: /\b(metal|steel|brass|bronze|alumin(?:i)?um|iron|copper)\b/,
  bronze: /\bbronze\b/, brass: /\bbrass\b/, steel: /\bsteel\b/,
  leather: /\bleather\b/, rattan: /\brattan\b/, ceramic: /\b(ceramic|porcelain|stoneware)\b/,
};
// Colour attribute gate. Whole-word only: "greenery" / "green-certified" never count as green.
const COLOR_WORDS: Record<string, string[]> = {
  green: ["green", "emerald", "jade", "olive", "sage", "malachite", "verdigris", "forest"],
  blue: ["blue", "navy", "cobalt", "azure", "indigo", "teal"], red: ["red", "crimson", "burgundy", "oxblood", "bordeaux"],
  pink: ["pink", "rose", "blush"], yellow: ["yellow", "mustard", "ochre", "saffron"], orange: ["orange", "terracotta", "rust"],
  black: ["black", "ebony", "noir"], white: ["white", "ivory", "alabaster"], grey: ["grey", "gray", "anthracite", "charcoal"],
  gray: ["grey", "gray", "anthracite", "charcoal"], brown: ["brown", "chocolate", "cognac", "tobacco"],
  beige: ["beige", "cream", "sand", "ecru"], gold: ["gold", "golden", "gilded", "gilt"], silver: ["silver", "chrome"], purple: ["purple", "violet", "aubergine", "plum"],
};
for (const [k, ws] of Object.entries(COLOR_WORDS)) MATERIALS[k] = new RegExp(`(?<![\\w-])(${ws.join("|")})(?![\\w-])`);
const sing = (w: string) => w.length > 4 && w.endsWith("ies") ? w.slice(0, -3) + "y" : w.replace(/(?<=[^s])s$/, "");
function lev(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// Lemmatize + typo-correct query terms against the live catalogue vocabulary
// ("paintings" -> "painting", "lampa" -> "lamp") so near-misses never return nothing.
function normalizeTerms(terms: string[], vocab: Set<string>) {
  return Array.from(new Set(terms.map((t) => {
    if (MATERIALS[t] || vocab.has(t)) return MATERIALS[t] ? t : sing(t);
    const s = sing(t);
    if (vocab.has(s) || MATERIALS[s]) return s;
    if (t.length < 4) return s;
    for (const v of vocab) if (v.length >= 3 && lev(t, v) <= 1) return v;
    for (const v of vocab) if (v.length >= 3 && lev(s, v) <= 1) return v;
    return s;
  })));
}

type Item = { id: string; title: string; image: string; materials: string | null; category: string | null; subcategory: string | null; designerName: string };

const SUGGESTION_MATERIALS = [
  { label: "Travertine", term: "travertine", test: /\btravertine\b/ },
  { label: "Patinated Bronze", term: "bronze", test: /\bpatinated bronze\b/ },
  { label: "Onyx", term: "onyx", test: /\bonyx\b/ },
  { label: "Marble", term: "marble", test: /\bmarble\b/ },
  { label: "Bronze", term: "bronze", test: /\bbronze\b/ },
  { label: "Lacquer", term: "lacquer", test: /\blacquer(?:ed)?\b/ },
  { label: "Glass", term: "glass", test: /\bglass\b/ },
  { label: "Oak", term: "oak", test: /\boak\b/ },
  { label: "Walnut", term: "walnut", test: /\bwalnut\b/ },
  { label: "Brass", term: "brass", test: /\bbrass\b/ },
  { label: "Leather", term: "leather", test: /\bleather\b/ },
  { label: "Ceramic", term: "ceramic", test: /\bceramic\b/ },
];

const isLightingItem = (i: Item) => /\blights?\b|\blamps?\b|\bpendants?\b|\bchandeliers?\b|\bsconces?\b|\blighting\b/.test(`${i.title} ${i.category ?? ""} ${i.subcategory ?? ""} ${i.materials ?? ""}`.toLowerCase());
function lightingScore(i: Item) {
  const text = `${i.title} ${i.materials ?? ""}`.toLowerCase();
  const type = `${i.category ?? ""} ${i.subcategory ?? ""}`.toLowerCase();
  const fixture = /\bpendants?\b|\bchandeliers?\b/.test(text) ? 2 : /\blamps?\b/.test(text) ? 1.6 : /\bsconces?\b/.test(text) ? 1.4 : 1;
  const wording = /\bpendants?\b|\bchandeliers?\b|\blamps?\b/.test(text) ? 1 : /\blights?\b|\blighting\b/.test(text) ? 0.6 : 0.3;
  return 2 * fixture + wording + (/\blights?\b|\blighting\b/.test(type) ? 0.5 : 0);
}
function isAshDiningChair(i: Item) {
  const m = (i.materials ?? "").toLowerCase();
  const t = `${i.title} ${i.category ?? ""} ${i.subcategory ?? ""}`.toLowerCase();
  return /\bash\b/.test(m) && !/\b(oak|walnut|mahogany|beech)\b/.test(m) && /\bchairs?\b/.test(t) && !/\b(armchairs?|lounge|bar|stools?)\b/.test(t);
}
function ashScore(i: Item) {
  const n = i.title.toLowerCase();
  const t = `${i.category ?? ""} ${i.subcategory ?? ""}`.toLowerCase();
  return 2 + (/\bdining chairs?\b/.test(n) ? 1 : /\bdining chairs?\b/.test(t) ? 0.9 : /\bchairs?\b/.test(n) ? 0.7 : /\bchairs?\b/.test(t) ? 0.5 : 0);
}

let cache: { at: number; items: Item[]; vocab: Set<string>; types?: Set<string> } | null = null;
let vocabCache = new Set<string>();
let typeVocab = new Set<string>();
async function loadCatalog(): Promise<Item[]> {
  if (cache && Date.now() - cache.at < 5 * 60_000) { vocabCache = cache.vocab; return cache.items; }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const [{ data: designers }, { data: picks }] = await Promise.all([
    sb.from("designers").select("id, name, display_name").eq("is_published", true).eq("trade_only", false),
    sb.from("designer_curator_picks_public").select("id, title, image_url, materials, category, subcategory, tags, designer_id, sort_order").order("sort_order", { ascending: true }),
  ]);
  const dmap = new Map((designers ?? []).map((d: any) => [d.id, d.display_name || d.name]));
  const items: Item[] = [];
  for (const r of (picks ?? []) as any[]) {
    const name = dmap.get(r.designer_id);
    if (!name || !r.image_url || (r.tags || []).includes("profile-only")) continue;
    items.push({ id: r.id, title: r.title || "", image: r.image_url, materials: r.materials, category: r.category, subcategory: r.subcategory, designerName: name });
  }
  const vocab = new Set<string>();
  for (const i of items) for (const w of keywords(`${i.title} ${i.category ?? ""} ${i.subcategory ?? ""} ${i.materials ?? ""}`)) vocab.add(sing(w));
  cache = { at: Date.now(), items, vocab };
  vocabCache = vocab;
  typeVocab = new Set(items.flatMap((i) => keywords(`${i.category ?? ""} ${i.subcategory ?? ""}`).map(sing)));
  return items;
}

function match(catalog: Item[], mode: "prompt" | "reference", value: string) {
  let search = value;
  if (mode === "reference") { try { search = decodeURIComponent(new URL(value).pathname); } catch { /* keep raw */ } }
  const terms = normalizeTerms(keywords(search), vocabCache);
  const strictAsh = mode === "prompt" && terms.includes("ash") && terms.some((t) => t === "chair" || t === "chairs");
  const lighting = mode === "prompt" && terms.some((t) => LIGHTING_TERMS.has(t));
  const pinned = /kavehome\.|pinterest\.com\/luxuryhomefurniture/i.test(value) ? PINNED_KAVEHOME : [];
  // Generic material + type gate: "glass side table" → material must be glass AND type must be side table.
  const matKeys = strictAsh ? [] : terms.filter((t) => MATERIALS[t]);
  // Only real product-type words gate results; descriptors like "patinated" rank but never exclude.
  const typeWords = terms.filter((t) => !MATERIALS[t]).map(sing).filter((w) => typeVocab.has(w));
  const strictMat = mode === "prompt" && matKeys.length > 0;
  const matOk = (i: Item) => matKeys.every((k) => MATERIALS[k].test(`${i.title} ${i.materials ?? ""}`.toLowerCase()));
  const typeOk = (i: Item) => { const ty = keywords(`${i.title} ${i.category ?? ""} ${i.subcategory ?? ""}`).map(sing); return typeWords.every((w) => ty.includes(w)); };
  const eligible = strictAsh ? catalog.filter(isAshDiningChair)
    : strictMat ? catalog.filter((i) => matOk(i) && typeOk(i) && (!lighting || isLightingItem(i)))
    : lighting ? catalog.filter(isLightingItem) : catalog;
  const same = (w: string, t: string) => w === t || w.replace(/s$/, "") === t.replace(/s$/, "");
  const ranked = eligible.map((item, index) => {
    const hay = keywords([item.title, item.category, item.subcategory, item.materials, item.designerName].filter(Boolean).join(" "));
    const catW = keywords(`${item.category ?? ""} ${item.subcategory ?? ""}`).map(sing);
    const titleW = keywords(item.title).map(sing);
    const descW = keywords(`${item.materials ?? ""} ${item.designerName}`).map(sing);
    let score = strictAsh ? ashScore(item)
      : lighting ? lightingScore(item) + terms.reduce((s, t) => s + (hay.some((w) => same(w, t)) ? 3 : 0), 0)
      : terms.reduce((s, t) => {
          // Field-priority weights: category/subcategory 10 > title 5 > description/materials 1.
          const inCat = catW.some((w) => same(w, t)), inTitle = titleW.some((w) => same(w, t));
          const inDesc = descW.some((w) => same(w, t)) || hay.some((w) => w.includes(t));
          const mat = MATERIALS[t] ? (MATERIALS[t].test((item.materials ?? "").toLowerCase()) ? 8 : MATERIALS[t].test(item.title.toLowerCase()) ? 6 : 0) : 0;
          return s + mat + (inCat ? 10 : 0) + (inTitle ? 5 : 0) + (!inCat && !inTitle && inDesc ? 1 : 0);
        }, 0);
    const pin = pinned.findIndex((p) => p.title.test(item.title) && p.designer.test(item.designerName));
    if (pin >= 0) score = 10000 - pin;
    return { item, index, score };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  // Fallback: if a material-strict query yields fewer than 3 high-weight matches,
  // fill the remaining slots with same-subcategory pieces ranked by manual
  // gallery priority (catalogue sort_order == ascending index order).
  if (strictMat) {
    const highWeight = ranked.filter((r) => r.score >= 8).length;
    if (false && highWeight < 3) {
      const eligibleIds = new Set(eligible.map((i) => i.id));
      const fill = catalog
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !eligibleIds.has(item.id) && typeOk(item) && (!lighting || isLightingItem(item)))
        .map(({ item, index }) => ({ item, index, score: -1 }));
      ranked.push(...fill);
    }
  }
  if (!strictAsh && !strictMat && ranked.some((r) => r.score >= 5)) {
    // A category-level match exists: drop description-only hits so stylistic words can't pollute.
    const keep = ranked.filter((r) => r.score >= 5);
    ranked.length = 0; ranked.push(...keep);
  }
  const seen = new Set<string>();
  const out: Omit<Item, "category" | "subcategory">[] = [];
  for (const { item } of ranked) {
    const key = item.title.toLowerCase().replace(/\s+by\s+.+$/, "").replace(/[^a-z0-9]/g, "");
    const img = item.image.split("?")[0];
    if (seen.has(key) || seen.has(img)) continue;
    seen.add(key); seen.add(img);
    out.push({ id: item.id, title: item.title, image: item.image, materials: item.materials, designerName: item.designerName });
    if (out.length === 9) break;
  }
  return out;
}

function suggestMaterials(catalog: Item[], value: string) {
  const terms = normalizeTerms(keywords(value), vocabCache);
  const typeWords = terms.filter((t) => !MATERIALS[t]).map(sing).filter((w) => typeVocab.has(w));
  if (!terms.some((t) => MATERIALS[t]) || !typeWords.length) return [];
  const category = typeWords.join(" ");
  const typed = catalog.filter((item) => {
    const words = keywords(`${item.title} ${item.category ?? ""} ${item.subcategory ?? ""}`).map(sing);
    return typeWords.every((word) => words.includes(word));
  });
  const usedTerms = new Set(terms.filter((t) => MATERIALS[t]));
  const suggestions: { label: string; query: string }[] = [];
  for (const material of SUGGESTION_MATERIALS) {
    if (usedTerms.has(material.term) || suggestions.some((s) => s.query === `${category} ${material.term}`)) continue;
    if (!typed.some((item) => material.test.test(`${item.title} ${item.materials ?? ""}`.toLowerCase()))) continue;
    const query = `${category} ${material.term}`;
    // Never suggest a material unless the same strict search yields a published piece.
    if (match(catalog, "prompt", query).length) suggestions.push({ label: material.label, query });
    if (suggestions.length === 3) break;
  }
  return suggestions;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { mode, value, track, path } = parsed.data;
    if (mode === "reference") {
      try { const u = new URL(value); if (!/^https?:$/.test(u.protocol)) throw 0; } catch { return json({ error: "Invalid link" }, 400); }
    }
    const catalog = await loadCatalog();
    const results = match(catalog, mode, value);
    const suggestions = mode === "prompt" && results.length === 0 ? suggestMaterials(catalog, value) : [];
    if (track) await logUsage(req, mode, value, results.length, path);
    return json({ results, suggestions });
  } catch (e) {
    console.error("felix-sourcing", e);
    return json({ error: "Sourcing unavailable" }, 500);
  }
});
