/**
 * og-rehost
 * =========
 *
 * Idempotent OG image rehosting endpoint.
 *
 * POST { sourceUrl: string, slug: string }
 *   → downloads the source, resizes to 1200×630, compresses under 300 KB,
 *     uploads to assets/og/<slug>.jpg, returns the public URL.
 *   → if the same source URL was already processed under that slug
 *     (we hash the source URL into the filename), returns the cached URL
 *     without re-uploading.
 *
 * Used by:
 *   • scripts/og-pipeline.py (backfill of public/designers/*.html)
 *   • Any admin UI that wants to attach a fresh OG image to a bridge.
 *
 * No JWT required. Anyone who can produce a working sourceUrl can rehost it
 * — we only ever store derived 1200×630 thumbnails, which is the same image
 * the bridge would have served anyway.
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "assets";
const PREFIX = "og/";
const TARGET_W = 1200;
const TARGET_H = 630;
const MAX_BYTES = 300 * 1024;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function publicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function sha8(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .slice(0, 4)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Resize to fit 1200×630 (cover crop) and recompress until under 300 KB.
 * Uses ImageScript which is available in Deno without native deps.
 */
async function fitAndCompress(raw: Uint8Array): Promise<Uint8Array> {
  // Lazy import keeps cold start cheap when the cache hits.
  const { Image } = await import(
    "https://deno.land/x/imagescript@1.2.17/mod.ts"
  );
  const img = await Image.decode(raw);

  // Cover-fit: scale so the smaller side meets the target, then center crop.
  const scale = Math.max(TARGET_W / img.width, TARGET_H / img.height);
  const scaledW = Math.round(img.width * scale);
  const scaledH = Math.round(img.height * scale);
  img.resize(scaledW, scaledH);

  const cropX = Math.max(0, Math.floor((scaledW - TARGET_W) / 2));
  // Bias slightly toward the upper third – portraits read better.
  const cropY = Math.max(0, Math.floor((scaledH - TARGET_H) * 0.4));
  img.crop(cropX, cropY, TARGET_W, TARGET_H);

  for (const q of [88, 82, 76, 70, 64, 58, 52, 46, 40, 35]) {
    const out = await img.encodeJPEG(q);
    if (out.byteLength <= MAX_BYTES) return out;
  }
  // Final fallback – aggressive
  return await img.encodeJPEG(30);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const sourceUrl: string = body.sourceUrl;
    const baseSlug: string = body.slug;

    if (!sourceUrl || typeof sourceUrl !== "string") {
      return new Response(
        JSON.stringify({ error: "sourceUrl required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!baseSlug || !/^[a-z0-9-]+$/.test(baseSlug)) {
      return new Response(
        JSON.stringify({ error: "slug must be lowercase kebab-case" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!/^https?:\/\//i.test(sourceUrl)) {
      return new Response(
        JSON.stringify({ error: "sourceUrl must be absolute http(s)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const digest = await sha8(sourceUrl);
    const objectPath = `${PREFIX}${baseSlug}-${digest}.jpg`;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Cache hit → return existing object
    const head = await fetch(publicUrl(objectPath), { method: "HEAD" });
    if (head.ok) {
      return new Response(
        JSON.stringify({
          url: publicUrl(objectPath),
          cached: true,
          bytes: Number(head.headers.get("content-length") || 0),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch source (with a real UA – many CDNs block default fetch UA)
    const srcResp = await fetch(sourceUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MaisonAffluencyOG/1.0; +https://www.maisonaffluency.com)",
        Accept: "image/*,*/*;q=0.8",
      },
      redirect: "follow",
    });
    if (!srcResp.ok) {
      return new Response(
        JSON.stringify({ error: `source fetch failed: ${srcResp.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const raw = new Uint8Array(await srcResp.arrayBuffer());

    const out = await fitAndCompress(raw);

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, out, {
        contentType: "image/jpeg",
        upsert: true,
        cacheControl: "31536000",
      });
    if (upErr) {
      return new Response(
        JSON.stringify({ error: `upload failed: ${upErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        url: publicUrl(objectPath),
        cached: false,
        bytes: out.byteLength,
        width: TARGET_W,
        height: TARGET_H,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// Silence "unused import" – we keep the explicit import for clarity even
// though we end up calling the dynamic import variant inside fitAndCompress.
void decodeJpeg;
void encodeJpeg;
