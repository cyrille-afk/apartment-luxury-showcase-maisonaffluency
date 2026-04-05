const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// All known OG bridge file paths (relative to site root)
const ALL_OG_PATHS: string[] = [
  // Root-level
  "alexander-lamont-og.html",
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
];

// Auto-discover: scan the live site for all OG bridge files
// This uses the file list baked into the function at deploy time
const SITE_BASE = "https://www.maisonaffluency.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

  const results: { url: string; ok: boolean; title?: string; error?: string }[] = [];
  const BATCH = 5;
  const DELAY = 300; // ms between batches to respect rate limits

  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    const promises = batch.map(async (url) => {
      try {
        const resp = await fetch(
          `https://graph.facebook.com/v19.0/?id=${encodeURIComponent(url)}&scrape=true&access_token=${token}`,
          { method: "POST" }
        );
        const text = await resp.text();
        let data;
        try { data = JSON.parse(text); } catch { return { url, ok: false, error: `Non-JSON: ${text.slice(0, 300)}` }; }
        if (data.og_object || data.title || data.id) {
          return { url, ok: true, title: data.og_object?.title || data.title || "" };
        }
        return { url, ok: false, error: data.error?.message || text.slice(0, 300) };
      } catch (e) {
        return { url, ok: false, error: String(e) };
      }
    });
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
    if (i + BATCH < urls.length) {
      await new Promise((r) => setTimeout(r, DELAY));
    }
  }

  const success = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return new Response(
    JSON.stringify({ success, failed, total: urls.length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
