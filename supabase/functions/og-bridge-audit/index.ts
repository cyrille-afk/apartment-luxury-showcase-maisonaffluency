// OG Bridge audit: fetches every public/*.html OG bridge from the live site,
// validates required og:* tags, bot-detection guard, and HEAD-checks og:image.
// Replaces the old per-route SEO audit (useless on an SPA without prerender).

// Default to the PRODUCTION host users actually share. Auditing the lovable.app
// preview is misleading: bridges can exist there but be missing / replaced by
// the SPA shell at the production CDN edge.
const DEFAULT_BASE = "https://www.maisonaffluency.com";
// Use a real bot UA so any UA-based routing matches what Facebook/WhatsApp see.
const UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const TIMEOUT_MS = 10000;
const CONCURRENCY = 12;
// Generic SPA-shell title; if a bridge returns this, the CDN served fallback.
const SPA_SHELL_TITLE_FRAGMENT = "Luxury Collectible Design";

// Hardcoded bridge inventory — mirrors public/ directory structure.
// Update when bridges are added or removed.
const BRIDGES_ROOT = [
  "alexander-lamont-card.html", "alexander-lamont-og.html",
  "apartment-tour-og.html", "apartment-tour-share-v6.html",
  "apparatus-studio-card.html", "apparatus-studio-og.html", "apparatus-studio-share-v6.html",
  "brands-og.html", "collectibles-og.html", "designers-og.html",
  "ecart-card.html", "ecart-og.html",
  "eileen-gray-card.html", "eileen-gray-og.html",
  "felix-aublet-card.html", "felix-aublet-og.html",
  "gallery-calming-og.html", "gallery-details-og.html", "gallery-home-office-og.html",
  "gallery-intimate-og.html", "gallery-og.html", "gallery-sanctuary-og.html",
  "gallery-small-room-og.html", "gallery-sociable-og.html",
  "jean-michel-frank-card.html", "jean-michel-frank-og.html",
  "laurent-maugoust-cecile-chenais-card.html", "laurent-maugoust-cecile-chenais-og.html",
  "leo-aerts-alinea-card.html", "leo-aerts-alinea-og.html",
  "mariano-fortuny-card.html", "mariano-fortuny-og.html",
  "new-in-og.html",
  "paul-laszlo-card.html", "paul-laszlo-og.html",
  "pierre-chareau-card.html", "pierre-chareau-og.html",
  "thierry-lemaire-og.html", "trade-program-og.html",
];

const BRIDGES_ATELIERS = [
  "achille-salvagni-atelier", "alinea-design-objects", "alpange", "apparatus-studio",
  "arredoluce", "atelier-demichelis", "cazes-and-conquet", "cc-tapis",
  "collection-particuliere", "de-la-espada", "delcourt-collection",
  "ecart-paris-designers", "ecart-paris", "entrelacs-creation", "haymann-editions",
  "iksel", "kerstens", "l-objet", "la-chance-paris", "marta-sala-editions",
  "mmairo", "okha-design-studio", "ozone", "peter-reed-1861", "pierre-frey",
  "poltrona-frau", "pouenat", "saint-louis", "se-collections", "serge-mouille",
  "stephane-cg", "theoreme-editions", "veronese", "victoria-magniant",
].flatMap((slug) => [`ateliers/${slug}-og.html`, `ateliers/${slug}-og-v2.html`]);

const BRIDGES_JOURNAL = [
  "journal/art-paris-2026-maison-affluency-designers-grand-palais-og.html",
  "journal/matter-shape-paris-march-6-9-2026-og.html",
  "journal/pouenat-ad-collector-ad100-design-2025-og.html",
  "journal/thierry-lemaire-radical-simplicity-og.html",
];

const ALL_BRIDGES = [...BRIDGES_ROOT, ...BRIDGES_ATELIERS, ...BRIDGES_JOURNAL];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">");

function parseBridge(html: string) {
  const og: Record<string, string> = {};
  const ogRe = /<meta\s+property=["'](og:[^"']+)["']\s+content=["']([^"']*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = ogRe.exec(html)) !== null) og[m[1]] = decode(m[2]);
  const tw: Record<string, string> = {};
  const twRe = /<meta\s+name=["'](twitter:[^"']+)["']\s+content=["']([^"']*)["']/gi;
  while ((m = twRe.exec(html)) !== null) tw[m[1]] = decode(m[2]);
  const hasRedirect = /window\.location\.replace/.test(html);
  const hasBotCheck = /!\/bot\|crawl\|spider/i.test(html) || /isBot|isCrawler/.test(html);
  return { og, tw, hasRedirect, hasBotCheck };
}

async function checkImage(url: string): Promise<{ ok: boolean; status: number; contentType: string; sizeKb?: number; error?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "user-agent": "WhatsApp/2.24.0" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    const ct = res.headers.get("content-type") ?? "";
    const len = parseInt(res.headers.get("content-length") ?? "0", 10);
    return {
      ok: res.status === 200 && ct.startsWith("image/"),
      status: res.status,
      contentType: ct,
      sizeKb: len ? Math.round(len / 1024) : undefined,
    };
  } catch (e) {
    return { ok: false, status: 0, contentType: "", error: (e as Error).message };
  } finally {
    clearTimeout(t);
  }
}

async function auditBridge(base: string, path: string, checkImages: boolean) {
  const url = `${base}/${path}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const issues: string[] = [];
  const warnings: string[] = [];
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, "cache-control": "no-cache", "pragma": "no-cache" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    const finalUrl = res.url;
    if (res.status !== 200) {
      return {
        path, url, finalUrl, status: res.status,
        issues: [`http_${res.status}`], warnings: [],
        og: {} as Record<string, string>,
        imageCheck: null as null | Awaited<ReturnType<typeof checkImage>>,
      };
    }
    const html = await res.text();
    const parsed = parseBridge(html);
    const { og, hasRedirect, hasBotCheck } = parsed;

    for (const tag of ["og:title", "og:image", "og:url", "og:site_name"]) {
      if (!og[tag]?.trim()) issues.push(`missing_${tag.replace(":", "_")}`);
    }

    // ── SPA-shell substitution detector ─────────────────────────────────
    // The CDN can return HTTP 200 with the generic index.html instead of the
    // bridge file. The audit was previously blind to this. Detect by:
    //  1) og:url path doesn't match the requested bridge path, OR
    //  2) og:title is the generic site title.
    const expectedPathTail = path.split("/").pop()!.toLowerCase();
    const ogUrlPath = (() => {
      try { return new URL(og["og:url"] ?? "").pathname.toLowerCase(); }
      catch { return ""; }
    })();
    const ogUrlMatches = ogUrlPath.endsWith(expectedPathTail);
    const isShellTitle = (og["og:title"] ?? "").includes(SPA_SHELL_TITLE_FRAGMENT)
      && !path.includes("collectibles") && !path.includes("trade-program");

    if (og["og:url"] && !ogUrlMatches) issues.push("spa_shell_served_wrong_og_url");
    if (isShellTitle) issues.push("spa_shell_served_generic_title");

    if (hasRedirect && !hasBotCheck) issues.push("redirect_without_bot_guard");
    if (!og["og:description"]) warnings.push("missing_og_description");
    if (!og["og:image:width"] || !og["og:image:height"]) warnings.push("missing_og_image_dims");
    if (!og["og:updated_time"]) warnings.push("missing_og_updated_time");

    let imageCheck = null as null | Awaited<ReturnType<typeof checkImage>>;
    if (checkImages && og["og:image"]) {
      imageCheck = await checkImage(og["og:image"]);
      if (!imageCheck.ok) issues.push(`og_image_${imageCheck.status || "error"}`);
      if (imageCheck.sizeKb && imageCheck.sizeKb > 300) warnings.push(`og_image_oversize_${imageCheck.sizeKb}kb`);
    }

    return { path, url, finalUrl, status: 200, issues, warnings, og, imageCheck };
  } catch (e) {
    return {
      path, url, finalUrl: url, status: 0,
      issues: [`fetch_error`], warnings: [],
      og: {} as Record<string, string>,
      imageCheck: null,
      error: (e as Error).message,
    };
  } finally {
    clearTimeout(t);
  }
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  }));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(req.url);
  const base = (url.searchParams.get("base") ?? DEFAULT_BASE).replace(/\/$/, "");
  const checkImages = url.searchParams.get("images") !== "0";

  const started = Date.now();
  const rows = await pool(ALL_BRIDGES, CONCURRENCY, (p) => auditBridge(base, p, checkImages));
  const elapsedMs = Date.now() - started;

  const summary = {
    base,
    total: rows.length,
    ok: rows.filter((r) => r.issues.length === 0).length,
    withIssues: rows.filter((r) => r.issues.length > 0).length,
    withWarnings: rows.filter((r) => r.warnings.length > 0).length,
    notFound: rows.filter((r) => r.status === 404).length,
    elapsedMs,
  };

  return new Response(JSON.stringify({ summary, rows }, null, 2), {
    headers: { ...cors, "content-type": "application/json" },
  });
});
