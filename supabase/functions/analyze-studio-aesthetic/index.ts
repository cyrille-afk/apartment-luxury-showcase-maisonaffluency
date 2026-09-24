// Studio Aesthetic DNA worker.
//
// Given a trade_account_id, scrapes the applicant's Instagram profile or website
// (Firecrawl), collects portfolio images, runs a Vision AI analysis via the
// Lovable AI Gateway, and writes the result to `studio_aesthetic_dna`.
// Invoked by `trade-program-signup` (service role) on step-3 completion, or by
// an admin from the Trade Applications queue (re-run).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { requireAdmin } from "../_shared/auth.ts";
import { modelFor } from "../_shared/aiModels.ts";
import { scoreTradeApplication } from "../_shared/tradeRadar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = modelFor("balanced");
const MAX_ATTEMPTS = 3;
const MAX_IMAGES = 6;
const UUID_RE = /^[0-9a-f-]{36}$/i;
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-CH-UA": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-CH-UA-Mobile": "?0",
  "Sec-CH-UA-Platform": '"macOS"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function retryDelay(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 1000), 15_000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.min(Math.max(date - Date.now(), 1000), 15_000);
  }
  return 1_000 * (2 ** attempt) + Math.floor(Math.random() * 350);
}

async function fetchWithRetry(input: string, init: RequestInit, attempts = 2): Promise<Response> {
  let response: Response | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    response = await fetch(input, init);
    if (response.status !== 429 && response.status < 500) return response;
    if (attempt + 1 < attempts) await wait(retryDelay(response, attempt));
  }
  return response as Response;
}

function resolveSourceUrl(ref: string | null): string | null {
  if (!ref) return null;
  const v = ref.trim();
  if (v.startsWith("@")) return `https://www.instagram.com/${v.slice(1)}/`;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function isCachedEvidenceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname.includes("/storage/v1/object/public/assets/studio-aesthetic/");
  } catch {
    return false;
  }
}

type ScrapeResult = { text: string; images: string[]; notes: string[] };

// Instagram blocks generic scrapers, so handles are read through the Meta
// Graph API's business_discovery (works for public Business/Creator accounts).
async function instagramViaGraph(handle: string): Promise<ScrapeResult> {
  const notes: string[] = [];
  const token = Deno.env.get("META_ACCESS_TOKEN");
  if (!token) return { text: "", images: [], notes: ["Meta token not configured"] };
  const G = "https://graph.facebook.com/v21.0";
  try {
    const acc = await fetchWithRetry(`${G}/me/accounts?fields=instagram_business_account&limit=25&access_token=${token}`, {
      headers: { Accept: "application/json" },
    }).then((r) => r.json());
    const igId = (acc?.data ?? []).map((p: any) => p?.instagram_business_account?.id).find(Boolean);
    if (!igId) return { text: "", images: [], notes: [`Instagram lookup unavailable (${acc?.error?.message ?? "no linked IG business account"})`] };
    const fields = `business_discovery.username(${encodeURIComponent(handle)}){username,name,biography,website,followers_count,media.limit(18){media_type,media_url,thumbnail_url,caption}}`;
    const d = await fetchWithRetry(`${G}/${igId}?fields=${fields}&access_token=${token}`, {
      headers: { Accept: "application/json" },
    }).then((r) => r.json());
    const bd = d?.business_discovery;
    if (!bd) return { text: "", images: [], notes: [`Instagram @${handle}: ${d?.error?.message ?? "not found or not a business/creator account"}`] };
    const media = (bd.media?.data ?? []) as any[];
    const images = media
      .map((m) => (m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url))
      .filter((u: unknown): u is string => typeof u === "string" && u.startsWith("https://"))
      .slice(0, MAX_IMAGES);
    const captions = media.map((m) => m.caption).filter(Boolean).slice(0, 12).join("\n---\n");
    const text = [`Instagram @${bd.username} — ${bd.name ?? ""}`, bd.biography ?? "", bd.website ? `Website: ${bd.website}` : "", captions]
      .filter(Boolean).join("\n").slice(0, 4000);
    return { text, images, notes: bd.website ? [`website:${bd.website}`] : notes };
  } catch (e) {
    return { text: "", images: [], notes: [`Instagram lookup error: ${(e as Error).message}`] };
  }
}

async function scrape(url: string): Promise<ScrapeResult> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  const images = new Set<string>();
  const notes: string[] = [];
  let text = "";
  if (!key) return { text, images: [], notes: ["Web reader not configured"] };
  try {
    const res = await fetchWithRetry("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: ["markdown", "html"],
        onlyMainContent: false,
        timeout: 30000,
        maxAge: 86_400_000,
        headers: BROWSER_HEADERS,
      }),
    });
    if (res.ok) {
      const d = (await res.json())?.data ?? {};
      text = String(d.markdown ?? "").slice(0, 4000);
      const og = d.metadata?.ogImage ?? d.metadata?.["og:image"];
      if (typeof og === "string") images.add(og);
      const html = String(d.html ?? "");
      for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
        const src = m[1];
        if (/^https:\/\//.test(src) && !/\.svg(\?|$)|sprite|logo|icon|avatar/i.test(src)) images.add(src);
        if (images.size >= MAX_IMAGES * 2) break;
      }
    } else {
      const t = (await res.text()).slice(0, 200);
      console.error("firecrawl failed", res.status, t);
      notes.push(`${new URL(url).hostname} blocked the reader (${res.status})`);
    }
  } catch (e) {
    console.error("firecrawl error", e);
    notes.push(`${url} unreachable`);
  }
  return { text, images: [...images].slice(0, MAX_IMAGES), notes };
}

const PERSONAL = /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|aol|proton|protonmail|qq|163|126|gmx|yandex|mail)\./i;

async function gather(ref: string | null, email: string | null): Promise<ScrapeResult & { source: string | null }> {
  const notes: string[] = [];
  const v = (ref ?? "").trim();
  const handle = v.startsWith("@") ? v.slice(1)
    : (v.match(/instagram\.com\/([A-Za-z0-9._]+)/i)?.[1] ?? null);
  let text = "", images: string[] = [], source: string | null = resolveSourceUrl(ref);
  const merge = (r: ScrapeResult) => {
    if (r.text) text = [text, r.text].filter(Boolean).join("\n\n").slice(0, 6000);
    images = [...new Set([...images, ...r.images])].slice(0, MAX_IMAGES);
  };
  let website: string | null = handle ? null : source;
  if (handle) {
    const ig = await instagramViaGraph(handle);
    merge(ig);
    for (const n of ig.notes) n.startsWith("website:") ? (website = n.slice(8)) : notes.push(n);
    // Keep the official API first. If it cannot resolve a public profile, use
    // the configured managed reader's cached/compliant retrieval path rather
    // than attempting direct HTML requests or proxy rotation from this worker.
    if (!ig.text && ig.images.length === 0 && source) {
      const managed = await scrape(source);
      merge(managed);
      notes.push(...managed.notes);
    }
  }
  if (website && images.length < MAX_IMAGES) { const r = await scrape(resolveSourceUrl(website)!); merge(r); notes.push(...r.notes); source ??= website; }
  // Last resort: the studio's own domain from a business email.
  const domain = email?.split("@")[1]?.toLowerCase();
  if (!text && images.length === 0 && domain && !PERSONAL.test(domain)) {
    const r = await scrape(`https://${domain}`);
    merge(r); notes.push(...r.notes);
    if (r.text || r.images.length) source = `https://${domain}`;
  }
  return { text, images, notes, source };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const isInternal = req.headers.get("Authorization") === `Bearer ${serviceKey}`;
  if (!isInternal) {
    const auth = await requireAdmin(req, "analyze-studio-aesthetic");
    if (!auth.ok) return json(auth.body, auth.status);
  }

  let body: { trade_account_id?: string } = {};
  try { body = await req.json(); } catch { /* */ }
  const id = String(body.trade_account_id ?? "");
  if (!UUID_RE.test(id)) return json({ error: "trade_account_id required" }, 400);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "AI is not configured" }, 500);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });

  const { data: account } = await supabase
    .from("trade_accounts").select("id, studio_name, website_or_ig, email, business_reg_number, radar_status").eq("id", id).maybeSingle();
  if (!account) return json({ error: "Trade account not found" }, 404);

  // Admin re-run also re-scores the AI Critical Radar if it never finished.
  if (!isInternal && account.radar_status !== "scored") {
    const radar = await scoreTradeApplication({
      studio: account.studio_name ?? "", email: account.email ?? "", websiteOrIg: account.website_or_ig ?? "",
      regNumber: account.business_reg_number ?? "", hasDocument: false, returning: false,
    });
    await supabase.from("trade_accounts").update(radar.ok
      ? { radar_score: radar.score, radar_flag: radar.flag, radar_status: "scored", radar_scored_at: new Date().toISOString() }
      : { radar_status: "failed", radar_flag: radar.error.slice(0, 300), radar_scored_at: new Date().toISOString() },
    ).eq("id", id);
  }

  const { data: dna } = await supabase
    .from("studio_aesthetic_dna")
    .select("status, attempts, image_urls, aesthetic_label, aesthetic_summary, dominant_tones, historical_affinities, materials")
    .eq("trade_account_id", id)
    .maybeSingle();
  if (dna?.status === "processing") return json({ ok: true, skipped: "already processing" });
  if (isInternal && (dna?.attempts ?? 0) >= MAX_ATTEMPTS) return json({ ok: false, skipped: "attempt cap" });

  const initialUrl = resolveSourceUrl(account.website_or_ig);
  await supabase.from("studio_aesthetic_dna").upsert({
    trade_account_id: id, status: "processing", source_url: initialUrl,
    attempts: (dna?.attempts ?? 0) + 1, error: null,
  }, { onConflict: "trade_account_id" });

  const { data: runRow } = await supabase.from("studio_evidence_runs")
    .insert({ trade_account_id: id, studio_name: account.studio_name }).select("id").maybeSingle();
  const run = { found: 0, cached: 0, reused: 0, skipped: [] as { url: string; reason: string }[], rl: 0, reader: [] as string[] };
  const logRun = async (outcome: string, error: string | null = null) => {
    if (!runRow?.id) return;
    await supabase.from("studio_evidence_runs").update({
      outcome, error: error?.slice(0, 1000) ?? null, images_found: run.found, images_cached: run.cached,
      images_reused: run.reused, skipped: run.skipped.slice(0, 20), rate_limited_count: run.rl,
      reader_failures: [...new Set(run.reader)].slice(0, 20), finished_at: new Date().toISOString(),
    }).eq("id", runRow.id);
  };

  const fail = async (error: string, status = 200) => {
    await supabase.from("studio_aesthetic_dna").update({ status: "failed", error: error.slice(0, 1000) }).eq("trade_account_id", id);
    await logRun("failed", error);
    return json({ ok: false, error }, status);
  };

  if (!initialUrl && !account.email) return fail("No website or Instagram handle supplied");

  const { text, images, notes, source } = await gather(account.website_or_ig, account.email);
  const sourceUrl = source ?? initialUrl ?? "";
  run.found = images.length;
  run.reader = notes.filter((n) => /blocked|unreachable|not configured|error|unavailable|429/i.test(n));
  run.rl += notes.filter((n) => /\(429\)/.test(n)).length;
  const priorImages = Array.isArray(dna?.image_urls)
    ? dna.image_urls.filter((url: unknown): url is string => typeof url === "string" && url.startsWith("https://"))
    : [];
  if (sourceUrl !== initialUrl) await supabase.from("studio_aesthetic_dna").update({ source_url: sourceUrl }).eq("trade_account_id", id);
  if (!text && images.length === 0 && priorImages.length === 0) {
    return fail(`Could not read the website / Instagram profile${notes.length ? ` — ${[...new Set(notes)].join("; ")}` : ""}`);
  }

  const { data: roster } = await supabase
    .from("designers").select("slug, name, specialty").eq("is_published", true).limit(150);
  const rosterLines = (roster ?? []).map((d: any) => `- ${d.slug} | ${d.name}${d.specialty ? ` | ${d.specialty}` : ""}`).join("\n");

  const prompt = [
    "You profile interior design studios applying to a luxury collectible-design trade platform.",
    `Studio: ${account.studio_name ?? "unknown"}`,
    `Source: ${sourceUrl}`,
    `Page text: ${text || "unavailable"}`,
    "The attached images are from the studio's portfolio / Instagram.",
    "Our designer roster (slug | name | specialty):",
    rosterLines,
    "Return JSON only:",
    '{"aesthetic_label":string (2-6 words),"aesthetic_summary":string (2-3 sentences),"dominant_tones":string[] (3-5),"historical_affinities":string[] (2-4 designers/movements),"materials":string[] (3-6),"matches":[{"slug":string,"rationale":string}] (up to 3, roster slugs only)}',
  ].join("\n");

  const content: unknown[] = [{ type: "text", text: prompt }];
  // Fetch images ourselves and inline them as data URLs: many CDNs block the
  // model provider's fetcher, which rejects the whole request.
  const candidates = [...new Set([...priorImages, ...images])].slice(0, MAX_IMAGES);
  const usable: string[] = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const url = candidates[index];
    if (isCachedEvidenceUrl(url)) {
      usable.push(url);
      run.reused += 1;
      continue;
    }
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 30_000);
      const r = await fetchWithRetry(url, {
        signal: ctl.signal,
        headers: {
          ...BROWSER_HEADERS,
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Sec-Fetch-Dest": "image",
          "Sec-Fetch-Mode": "no-cors",
          "Sec-Fetch-Site": "cross-site",
          Referer: /(?:instagram\.com|fbcdn\.net)/i.test(url) ? "https://www.instagram.com/" : sourceUrl,
        },
      });
      clearTimeout(t);
      const type = r.headers.get("content-type") ?? "";
      if (!r.ok || !/^image\/(jpeg|png|webp|gif)/.test(type)) {
        if (r.status === 429) { run.rl += 1; console.warn("portfolio image rate limited after bounded retry", new URL(url).hostname); }
        run.skipped.push({ url, reason: r.ok ? `unsupported type ${type || "unknown"}` : `HTTP ${r.status}` });
        continue;
      }
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.length < 5_000 || buf.length > 4_000_000) { run.skipped.push({ url, reason: buf.length < 5_000 ? "too small (<5KB)" : "too large (>4MB)" }); continue; }
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      content.push({ type: "image_url", image_url: { url: `data:${type.split(";")[0]};base64,${btoa(bin)}` } });
      const extension = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("gif") ? "gif" : "jpg";
      const path = `studio-aesthetic/${id}/evidence-${index + 1}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("assets").upload(path, buf, {
        contentType: type.split(";")[0],
        cacheControl: "31536000",
        upsert: true,
      });
      if (uploadError) {
        console.warn("portfolio image cache failed", path, uploadError.message);
        usable.push(url);
      } else {
        const { data: publicAsset } = supabase.storage.from("assets").getPublicUrl(path);
        usable.push(publicAsset.publicUrl);
        run.cached += 1;
      }
    } catch (e) { run.skipped.push({ url, reason: (e as Error)?.name === "AbortError" ? "timeout" : "unreachable" }); }
  }

  // Persist evidence before invoking AI. A later gateway rejection or rate
  // limit must not leave the Visual Evidence Matrix blank or force a rescrape.
  const cachedEvidence = [...new Set([...usable, ...priorImages])].slice(0, MAX_IMAGES);
  if (cachedEvidence.length > 0) {
    const { error: evidenceError } = await supabase
      .from("studio_aesthetic_dna")
      .update({ image_urls: cachedEvidence })
      .eq("trade_account_id", id);
    if (evidenceError) console.error("portfolio evidence persistence failed", evidenceError.message);
  }

  const aiRes = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content }], response_format: { type: "json_object" } }),
  });
  if (!aiRes.ok) {
    const t = (await aiRes.text()).slice(0, 500);
    console.error("gateway error", aiRes.status, t);
    // Terminal: 402/403 credits/policy; 429 retry later by admin re-run.
    return fail(`AI analysis failed (${aiRes.status})`);
  }
  const raw = (await aiRes.json())?.choices?.[0]?.message?.content ?? "";
  let parsed: any;
  try { parsed = JSON.parse(String(raw).replace(/^```(json)?|```$/g, "").trim()); }
  catch { return fail("AI returned an unreadable analysis"); }

  const slugs = new Set((roster ?? []).map((d: any) => d.slug));
  const arr = (v: unknown) => Array.isArray(v) ? v.map(String).slice(0, 8) : [];
  await supabase.from("studio_aesthetic_dna").update({
    status: "complete",
    // A transient CDN block must never blank evidence that was already saved.
    image_urls: cachedEvidence,
    aesthetic_label: parsed.aesthetic_label ? String(parsed.aesthetic_label).slice(0, 120) : null,
    aesthetic_summary: parsed.aesthetic_summary ? String(parsed.aesthetic_summary).slice(0, 1500) : null,
    dominant_tones: arr(parsed.dominant_tones),
    historical_affinities: arr(parsed.historical_affinities),
    materials: arr(parsed.materials),
    predicted_designer_matches: (Array.isArray(parsed.matches) ? parsed.matches : []).filter((m: any) => slugs.has(m?.slug)).slice(0, 3),
    raw_analysis: parsed,
    model: MODEL,
    error: null,
    analyzed_at: new Date().toISOString(),
  }).eq("trade_account_id", id);
  await logRun("complete");

  return json({ ok: true });
});
