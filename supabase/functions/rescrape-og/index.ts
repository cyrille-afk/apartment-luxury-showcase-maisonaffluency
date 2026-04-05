const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

  // Parse body for URLs or use defaults
  let urls: string[] = [];
  try {
    const body = await req.json();
    if (body.urls && Array.isArray(body.urls)) {
      urls = body.urls;
    }
  } catch {
    // no body
  }

  if (urls.length === 0) {
    return new Response(
      JSON.stringify({ error: "Provide { urls: [...] } in body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const results: { url: string; ok: boolean; title?: string; error?: string }[] = [];
  const BATCH = 5;

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
    // Small delay between batches
    if (i + BATCH < urls.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const success = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return new Response(
    JSON.stringify({ success, failed, total: urls.length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
