/**
 * Maison Affluency — Crawler Prerender Worker
 *
 * Sits in front of the Lovable origin on the maisonaffluency.com zone.
 * - Real users: pass straight through to origin (no latency added).
 * - Crawler UAs (Googlebot, social previews, AI crawlers): render the route
 *   in a headless browser via Cloudflare Browser Rendering, strip scripts,
 *   cache the HTML in KV for 24h, and return the snapshot.
 *
 * Bindings expected (see wrangler.toml):
 *   BROWSER  — Cloudflare Browser Rendering binding
 *   CACHE    — KV namespace for snapshot cache
 *
 * Env vars:
 *   ORIGIN_HOST    — host the Worker forwards real users to (Lovable hosting).
 *                    e.g. apartment-luxury-showcase-maisonaffluency.lovable.app
 *   CACHE_TTL_SEC  — snapshot cache TTL (default 86400 = 24h)
 *   RENDER_TIMEOUT — ms to wait for networkidle (default 12000)
 */

const CRAWLER_UA = /bot|crawl|spider|slurp|bingpreview|mediapartners|facebookexternalhit|whatsapp|telegram|slack|discord|linkedin|twitter|pinterest|embedly|quora|outbrain|vkshare|w3c_validator|tumblr|baiduspider|yandex|duckduckbot|applebot|gptbot|oai-searchbot|chatgpt-user|perplexitybot|claudebot|claude-web|anthropic-ai|cohere-ai|youbot|amazonbot|petalbot|semrushbot|ahrefsbot|mj12bot/i;

// Routes the Worker should NEVER prerender (auth-gated, dynamic data, large bundles).
const SKIP_PATTERNS = [
  // Keep authenticated Trade Portal routes private, but allow the public
  // `/trade-program` landing page to receive crawler-rendered OG metadata.
  /^\/trade(?:\/|$)/,
  /^\/studio(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/board\//,
  /^\/api\//,
  /^\/auth(\/|$)/,
  /^\/reset-password/,
];

// Don't proxy these paths through the renderer — they are real files / non-HTML.
const PASSTHROUGH_EXT = /\.(png|jpe?g|webp|avif|gif|svg|ico|css|js|mjs|map|json|xml|txt|woff2?|ttf|otf|pdf|mp4|webm|mp3|wav|zip)$/i;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const ua = request.headers.get("user-agent") || "";
    const isCrawler = CRAWLER_UA.test(ua);
    const isHtmlRoute = !PASSTHROUGH_EXT.test(url.pathname);
    const isSkipped = SKIP_PATTERNS.some((re) => re.test(url.pathname));

    // The Trade Program has a dedicated static app shell containing its full
    // Open Graph image metadata. Return it directly so WhatsApp never depends
    // on browser rendering, the SPA shell, or an old prerender cache.
    if (isCrawler && url.pathname.replace(/\/$/, "") === "/trade-program") {
      return new Response(tradeProgramShareHtml(), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=300",
          "x-robots-tag": "index, follow",
          "x-prerender-source": "trade-program-static-og",
        },
      });
    }

    // Real users + assets + skipped routes -> straight to origin.
    if (!isCrawler || !isHtmlRoute || isSkipped) {
      return forwardToOrigin(request, env);
    }

    // Crawler hit on an HTML route — try cache first.
    const cacheKey = `snap:${url.pathname}${url.search}`;
    const cached = await env.CACHE.get(cacheKey);
    if (cached) {
      return new Response(cached, {
        headers: snapshotHeaders({ source: "cache", path: url.pathname }),
      });
    }

    // Render with Browser Rendering.
    let snapshot;
    try {
      snapshot = await renderSnapshot(url, env);
    } catch (err) {
      // If rendering fails, fall back to origin SPA shell so we don't 5xx the crawler.
      console.error("render failed", url.pathname, err?.message);
      return forwardToOrigin(request, env, {
        "x-prerender-fallback": "render-failed",
      });
    }

    const ttl = parseInt(env.CACHE_TTL_SEC || "86400", 10);
    ctx.waitUntil(env.CACHE.put(cacheKey, snapshot, { expirationTtl: ttl }));

    return new Response(snapshot, {
      headers: snapshotHeaders({ source: "render", path: url.pathname }),
    });
  },
};

function tradeProgramShareHtml() {
  const title = "Trade Program — Maison Affluency";
  const description = "Exclusive benefits for architects, interior designers, and luxury hospitality professionals.";
  const canonical = "https://www.maisonaffluency.com/trade-program";
  const image = "https://www.maisonaffluency.com/trade-program-hero-whatsapp.jpg";
  return `<!doctype html><html lang="en"><head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <link rel="canonical" href="${canonical}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Maison Affluency">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:secure_url" content="${image}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Maison Affluency Trade Program">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${image}">
  </head><body><main><h1>${title}</h1><p>${description}</p><img src="${image}" alt="Maison Affluency Trade Program" width="1200" height="630"></main></body></html>`;
}

async function forwardToOrigin(request, env, extraHeaders = {}) {
  const url = new URL(request.url);
  url.hostname = env.ORIGIN_HOST;
  // Preserve method, body, and headers; let the origin set its own caching.
  const init = {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: "manual",
  };
  const res = await fetch(url.toString(), init);
  if (Object.keys(extraHeaders).length === 0) return res;
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(extraHeaders)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

async function renderSnapshot(url, env) {
  // Always render against the public canonical host so Helmet writes the
  // correct canonical/og:url, not the *.lovable.app origin.
  const renderUrl = new URL(url.toString());
  renderUrl.hostname = "maisonaffluency.com";
  renderUrl.protocol = "https:";

  const timeout = parseInt(env.RENDER_TIMEOUT || "12000", 10);

  // Cloudflare Browser Rendering binding — Puppeteer-compatible API.
  // https://developers.cloudflare.com/browser-rendering/
  const puppeteer = await import("@cloudflare/puppeteer");
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (compatible; MaisonAffluencyPrerender/1.0; +https://maisonaffluency.com)"
    );
    // Block heavy assets we don't need in the snapshot — speeds up render and
    // reduces Browser Rendering minutes.
    await page.setRequestInterception?.(true);
    page.on?.("request", (req) => {
      const t = req.resourceType?.();
      if (t === "image" || t === "media" || t === "font") return req.abort();
      return req.continue();
    });

    await page.goto(renderUrl.toString(), {
      waitUntil: "networkidle0",
      timeout,
    });

    // Give Helmet a beat to commit head mutations after hydration.
    await page.waitForFunction(
      () => !!document.querySelector('link[rel="canonical"]'),
      { timeout: 4000 }
    ).catch(() => {});

    let html = await page.content();
    html = stripScripts(html);
    return html;
  } finally {
    await browser.close().catch(() => {});
  }
}

/** Remove <script> tags from snapshot — crawlers don't need them, and
 *  shipping the whole bundle inside a server-rendered shell wastes bytes
 *  and risks double-hydration weirdness if a real browser ever sees it. */
function stripScripts(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<link\b[^>]*rel=["']?modulepreload["']?[^>]*>/gi, "");
}

function snapshotHeaders({ source, path }) {
  return {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "public, max-age=300",
    "x-prerender": "1",
    "x-prerender-source": source,
    "x-prerender-path": path,
    "x-robots-tag": "all",
  };
}
