/**
 * Verifies every public designer profile serves its own Open Graph tags and
 * a share-ready image in the server-rendered HTML (what WhatsApp sees).
 *
 * Run: bun scripts/verify-designer-og.ts [baseUrl]
 *   baseUrl defaults to https://www.maisonaffluency.com (use http://localhost:8080 for preview).
 * Options via env: OG_LIMIT=20 (check first N designers), OG_SKIP_IMAGES=1.
 * Exits 1 if any profile fails.
 */
import { createClient } from "@supabase/supabase-js";
import { designerSeoDescription, displayName } from "@/lib/designerSeo";
import { isChildBrandDesigner } from "@/lib/designerHierarchy";
import { getDesignerOpenGraph } from "@/lib/designerOpenGraph";

const BASE = (process.argv[2] || "https://www.maisonaffluency.com").replace(/\/$/, "");
const UA = "WhatsApp/2.23.20.0 A";
const MAX_IMAGE_BYTES = 300_000;
const LIMIT = Number(process.env.OG_LIMIT || 0);
const SKIP_IMAGES = process.env.OG_SKIP_IMAGES === "1";

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

function metaAll(html: string, prop: string): string[] {
  const out: string[] = [];
  const re = /<meta\s[^>]*>/gi;
  for (const tag of html.match(re) ?? []) {
    const key = tag.match(/(?:property|name)=["']([^"']+)["']/i)?.[1];
    if (key !== prop) continue;
    const content = tag.match(/content=["']([^"']*)["']/i)?.[1];
    if (content != null) out.push(decode(content));
  }
  return out;
}

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
if (!url || !key) throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: designers, error } = await supabase
  .from("designers")
  .select("slug, name, founder, specialty, biography, hero_image_url, image_url, is_independent")
  .eq("trade_only", false)
  .order("slug");
if (error) throw error;
const list = LIMIT ? designers!.slice(0, LIMIT) : designers!;

const imageCache = new Map<string, Promise<string | null>>();
function checkImage(src: string): Promise<string | null> {
  if (!imageCache.has(src)) {
    imageCache.set(src, (async () => {
      if (!/^https:\/\//.test(src)) return `image not absolute https: ${src}`;
      const r = await fetch(src, { headers: { "user-agent": UA } });
      if (!r.ok) return `image HTTP ${r.status}`;
      const type = r.headers.get("content-type") || "";
      if (!/image\/(jpeg|png|webp)/.test(type)) return `image content-type ${type}`;
      const bytes = (await r.arrayBuffer()).byteLength;
      if (bytes >= MAX_IMAGE_BYTES) return `image ${bytes} bytes (≥ 300KB)`;
      return null;
    })().catch((e) => `image fetch failed: ${e}`));
  }
  return imageCache.get(src)!;
}

async function verify(d: (typeof list)[number]): Promise<string[]> {
  const name = displayName(d.name);
  const expected = getDesignerOpenGraph({
    slug: d.slug,
    name,
    description: designerSeoDescription({
      name, founder: d.founder, specialty: d.specialty, biography: d.biography,
      isChildDesigner: isChildBrandDesigner(d), slug: d.slug,
    }),
    heroImage: d.hero_image_url || d.image_url,
  });
  const res = await fetch(`${BASE}/designers/${d.slug}`, { headers: { "user-agent": UA } });
  if (!res.ok) return [`HTTP ${res.status}`];
  const html = await res.text();
  const fails: string[] = [];
  const want: Record<string, string | undefined> = {
    "og:title": expected.title,
    "og:description": expected.description,
    "og:image": expected.image,
    "og:url": expected.url,
    "og:type": expected.type,
    "twitter:image": expected.image,
    "og:image:type": expected.imageType,
  };
  for (const [prop, value] of Object.entries(want)) {
    if (value === undefined) continue;
    const got = metaAll(html, prop);
    if (got.length !== 1) fails.push(`${prop}: expected 1 tag, found ${got.length}`);
    else if (got[0] !== value) fails.push(`${prop}: "${got[0]}" ≠ "${value}"`);
  }
  if (!SKIP_IMAGES && expected.image) {
    const imgErr = await checkImage(expected.image);
    if (imgErr) fails.push(imgErr);
  }
  return fails;
}

let failed = 0;
const CONCURRENCY = 6;
for (let i = 0; i < list.length; i += CONCURRENCY) {
  const batch = list.slice(i, i + CONCURRENCY);
  const results = await Promise.all(batch.map((d) => verify(d).catch((e) => [String(e)])));
  batch.forEach((d, j) => {
    if (results[j].length) {
      failed++;
      console.log(`FAIL ${d.slug}`);
      results[j].forEach((f) => console.log(`     ${f}`));
    }
  });
}
console.log(`\n${list.length - failed}/${list.length} designer profiles serve correct OG tags (${BASE}).`);
if (failed) process.exit(1);
