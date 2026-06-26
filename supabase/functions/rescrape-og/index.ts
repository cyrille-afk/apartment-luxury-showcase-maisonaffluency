const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// All known OG bridge file paths (relative to site root)
// Baked-in fallback list — the function prefers og-manifest.json at runtime
const ALL_OG_PATHS: string[] = [
  "alexander-lamont-og.html",
  "apartment-tour-og.html",
  "apparatus-studio-og.html",
  "brands-og.html",
  "collectibles-og.html",
  "designers-og.html",
  "ecart-og.html",
  "eileen-gray-og.html",
  "felix-aublet-og.html",
  "gallery-calming-og.html",
  "gallery-details-og.html",
  "gallery-home-office-og.html",
  "gallery-intimate-og.html",
  "gallery-og.html",
  "gallery-sanctuary-og.html",
  "gallery-small-room-og.html",
  "gallery-sociable-og.html",
  "jean-michel-frank-og.html",
  "laurent-maugoust-cecile-chenais-og.html",
  "leo-aerts-alinea-og.html",
  "mariano-fortuny-og.html",
  "new-in-og.html",
  "paul-laszlo-og.html",
  "pierre-chareau-og.html",
  "thierry-lemaire-og.html",
  "trade-program-og.html",
  // Gallery item bridges
  "gallery/a-colourful-nook.html",
  "gallery/a-design-treasure-trove.html",
  "gallery/a-dreamy-tuscan-landscape.html",
  "gallery/a-highly-customised-dining-room.html",
  "gallery/a-jewelry-box-like-setting.html",
  "gallery/a-masterful-suite.html",
  "gallery/a-relaxed-setting.html",
  "gallery/a-serene-decor.html",
  "gallery/a-sophisticated-boudoir.html",
  "gallery/a-sophisticated-living-room.html",
  "gallery/a-sun-lit-reading-corner.html",
  "gallery/a-venitian-cocoon.html",
  "gallery/a-workspace-of-distinction.html",
  "gallery/an-artistic-statement.html",
  "gallery/an-inviting-lounge-area.html",
  "gallery/compact-elegance.html",
  "gallery/craftsmanship-at-every-corner.html",
  "gallery/curated-vignette.html",
  "gallery/design-and-fine-art-books-corner.html",
  "gallery/design-tableau.html",
  "gallery/golden-hour.html",
  "gallery/light-and-focus.html",
  "gallery/light-and-texture.html",
  "gallery/panoramic-cityscape-views.html",
  "gallery/refined-details.html",
  "gallery/the-details-make-the-design.html",
  "gallery/unique-by-design-vignette.html",
  "gallery/yellow-crystalline.html",
];

// Auto-discover: scan the live site for all OG bridge files
// This uses the file list baked into the function at deploy time
const SITE_BASE = "https://www.maisonaffluency.com";

import { requireAdmin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require admin (or service-role bearer via shared helper) — prevents
  // anonymous abuse of Meta's scrape API under our app token.
  const auth = await requireAdmin(req, "rescrape-og");
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  const META_APP_ID = Deno.env.get("META_APP_ID");
  const META_APP_SECRET = Deno.env.get("META_APP_SECRET");

  if (!META_APP_ID || !META_APP_SECRET) {
    return new Response(
      JSON.stringify({ error: "META_APP_ID or META_APP_SECRET not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get app access token
  const tokenResp = await fetch(
    `https://graph.facebook.com/oauth/access_token?client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&grant_type=client_credentials`
  );
  const tokenData = await tokenResp.json();
  if (!tokenData.access_token) {
    return new Response(
      JSON.stringify({ error: "Failed to get app token", detail: tokenData }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const token = tokenData.access_token;

  // Parse body
  let urls: string[] = [];
  let mode = "custom";
  let category = "all"; // "designers", "ateliers", "journal", "all"
  try {
    const body = await req.json();
    if (body.all === true) {
      mode = "all";
      category = body.category || "all";
    } else if (body.urls && Array.isArray(body.urls)) {
      urls = body.urls;
    }
  } catch {
    // no body
  }

  if (mode === "all") {
    // Build full URL list from known paths + discover from site
    // We'll fetch the sitemap of OG files from the deployed site
    try {
      const resp = await fetch(`${SITE_BASE}/og-manifest.json?t=${Date.now()}`);
      if (resp.ok) {
        const manifest = await resp.json();
        if (Array.isArray(manifest)) {
          urls = manifest.map((p: string) => `${SITE_BASE}/${p}`);
        }
      }
    } catch {
      // fallback: use baked-in list
    }

    // If manifest not available, use the baked-in ALL_OG_PATHS
    if (urls.length === 0) {
      urls = ALL_OG_PATHS.map((p) => `${SITE_BASE}/${p}`);
    }

    // Filter by category if needed
    if (category !== "all") {
      urls = urls.filter((u) => u.includes(`/${category}/`));
    }
  }

  if (urls.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Provide { urls: [...] } or { all: true } in body' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const results: { url: string; ok: boolean; title?: string; error?: string; retried?: number }[] = [];
  const BATCH = 2;          // Meta caps per-app calls aggressively; keep concurrency low
  const DELAY = 1500;       // ms between batches → ~1.3 req/s sustained

  // Backoff schedule when Meta returns (#4) Application request limit reached.
  // Edge function wall budget is ~150s, so we cap total cooldown at ~120s and
  // surface remaining urls + a resumeAt timestamp so the caller can resume.
  const COOLDOWN_MS = [30_000, 60_000, 90_000];
  const RATE_CODES = new Set([4, 17, 32, 613]);
  const isRateLimit = (err: any) =>
    err && (RATE_CODES.has(err.code) || /request limit reached|rate limit/i.test(err.message || ""));

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const scrapeOne = async (url: string) => {
    const resp = await fetch(
      `https://graph.facebook.com/v19.0/?id=${encodeURIComponent(url)}&scrape=true&access_token=${token}`,
      { method: "POST" }
    );
    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { return { url, ok: false, error: `Non-JSON: ${text.slice(0, 300)}` } as const; }
    if (isRateLimit(data.error)) {
      return { url, ok: false, rateLimited: true, error: data.error.message } as const;
    }
    if (data.og_object || data.title || data.id) {
      return { url, ok: true, title: data.og_object?.title || data.title || "" } as const;
    }
    return { url, ok: false, error: data.error?.message || text.slice(0, 300) } as const;
  };

  let cooldownsUsed = 0;
  let pausedMs = 0;
  let resumeAt: string | null = null;
  let remaining: string[] = [];

  outer: for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(scrapeOne));

    const hitLimit = batchResults.some((r: any) => r.rateLimited);

    if (hitLimit) {
      // Collect URLs in this batch that hit the limit — they must be retried.
      const toRetry: string[] = batchResults.filter((r: any) => r.rateLimited).map((r: any) => r.url);
      // Push the successes/non-rate failures from this batch.
      for (const r of batchResults) {
        if (!(r as any).rateLimited) results.push(r as any);
      }

      // Try escalating cooldowns, then retry the failed URLs once each.
      let recovered = false;
      while (cooldownsUsed < COOLDOWN_MS.length && !recovered) {
        const wait = COOLDOWN_MS[cooldownsUsed++];
        pausedMs += wait;
        await sleep(wait);
        const retryResults = await Promise.all(toRetry.map(scrapeOne));
        const stillLimited = retryResults.some((r: any) => r.rateLimited);
        if (!stillLimited) {
          for (const r of retryResults) results.push({ ...(r as any), retried: cooldownsUsed });
          recovered = true;
        } else if (cooldownsUsed >= COOLDOWN_MS.length) {
          // Exhausted: keep the limited URLs in `remaining` for the caller to resume.
          remaining = [
            ...retryResults.filter((r: any) => r.rateLimited).map((r: any) => r.url),
            ...urls.slice(i + BATCH),
          ];
          for (const r of retryResults) {
            if ((r as any).rateLimited) {
              results.push({ url: (r as any).url, ok: false, error: "Paused — Meta app rate limit; resume after window" });
            } else {
              results.push({ ...(r as any), retried: cooldownsUsed });
            }
          }
          // Suggested resume in 1h (Meta app hourly window).
          resumeAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
          for (const url of urls.slice(i + BATCH)) {
            results.push({ url, ok: false, error: "Skipped — paused after rate limit" });
          }
          break outer;
        }
      }
    } else {
      results.push(...(batchResults as any));
    }

    if (i + BATCH < urls.length) {
      await sleep(DELAY);
    }
  }

  const success = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return new Response(
    JSON.stringify({
      success,
      failed,
      total: urls.length,
      pausedMs,
      cooldownsUsed,
      resumeAt,
      remaining,
      results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
