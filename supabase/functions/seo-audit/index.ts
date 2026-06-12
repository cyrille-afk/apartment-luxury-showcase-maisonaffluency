// SEO audit edge function: fetches each public route on the canonical site,
// parses <title>, <meta description>, <link rel=canonical>, and returns a
// JSON report with duplicate/missing-tag detection.
//
// Defaults to https://www.maisonaffluency.com but accepts ?base= override.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const DEFAULT_BASE = "https://apartment-luxury-showcase-maisonaffluency.lovable.app";
const UA = "MaisonAffluency-SEO-Audit/1.0";
const TIMEOUT_MS = 8000;
const CONCURRENCY = 24;

const STATIC_ROUTES = [
  "/",
  "/designers",
  "/collectibles",
  "/gallery",
  "/journal",
  "/contact",
  "/trade-program",
  "/new-in",
  "/apartment-tour",
  "/studios",
  "/favorites",
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">");

function extract(html: string) {
  const t = html.match(/<title>([\s\S]*?)<\/title>/i);
  const d = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const cPre = html.match(/<link\s+rel=["']canonical["'][^>]*data-prerender=["']true["'][^>]*href=["']([^"']+)["']/i)
    || html.match(/<link\s+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*data-prerender=["']true["']/i);
  const cAny = html.match(/<link\s+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return {
    title: decode(t?.[1]?.trim() ?? ""),
    description: decode(d?.[1]?.trim() ?? ""),
    canonical: (cPre?.[1] ?? cAny?.[1] ?? "").trim(),
    h1: decode((h1?.[1] ?? "").replace(/<[^>]+>/g, "").trim()),
  };
}

async function fetchRoute(base: string, path: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const target = `${base}${path}`;
    const res = await fetch(target, {
      headers: { "user-agent": UA, accept: "text/html", "cache-control": "no-cache", pragma: "no-cache" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    const html = await res.text();
    let meta = extract(html);

    // Lovable hosting can serve the SPA shell for clean static routes (/foo)
    // while the prerendered HTML exists at the exact generated .html object.
    // Audit the prerender artifact when the clean URL clearly returned the
    // homepage shell; this prevents false duplicate reports after publish.
    let canonicalPath = "";
    try { canonicalPath = new URL(meta.canonical).pathname.replace(/\/$/, "") || "/"; } catch (_) {}
    if (path !== "/" && res.status === 200 && canonicalPath === "/") {
      for (const prerenderTarget of [`${target}/index.html`, `${target}.html`]) {
        try {
          const fileRes = await fetch(prerenderTarget, {
            headers: { "user-agent": UA, accept: "text/html", "cache-control": "no-cache", pragma: "no-cache" },
            redirect: "follow",
            signal: ctrl.signal,
          });
          if (fileRes.status === 200) {
            meta = extract(await fileRes.text());
            break;
          }
        } catch (_) {}
      }
    }
    return { path, status: res.status, ...meta };
  } catch (e) {
    return {
      path,
      status: 0,
      title: "",
      description: "",
      canonical: "",
      h1: "",
      error: (e as Error)?.message ?? String(e),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

import { requireAdmin } from "../_shared/auth.ts";

// Allowed base hosts for ?base= override — prevents using this endpoint as
// a force-multiplying SSRF proxy against arbitrary targets.
const ALLOWED_BASE_HOSTS = new Set([
  "www.maisonaffluency.com",
  "maisonaffluency.com",
  "apartment-luxury-showcase-maisonaffluency.lovable.app",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Admin-only: fans out 24+ concurrent fetches per call, so any caller-controlled
  // base URL would be an SSRF amplifier. Also limit to canonical site hosts.
  const auth = await requireAdmin(req, "seo-audit");
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { ...cors, "content-type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const baseParam = (url.searchParams.get("base") ?? DEFAULT_BASE).replace(/\/$/, "");
  let base: string;
  try {
    const parsed = new URL(baseParam);
    if (!ALLOWED_BASE_HOSTS.has(parsed.host) || !/^https?:$/.test(parsed.protocol)) {
      return new Response(JSON.stringify({ error: "base host not allowed" }), {
        status: 400, headers: { ...cors, "content-type": "application/json" },
      });
    }
    base = `${parsed.protocol}//${parsed.host}`;
  } catch {
    return new Response(JSON.stringify({ error: "invalid base URL" }), {
      status: 400, headers: { ...cors, "content-type": "application/json" },
    });
  }
  const sample = Math.max(1, parseInt(url.searchParams.get("sample") ?? "30", 10));
  const includeProducts = url.searchParams.get("products") === "1";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const paths = [...STATIC_ROUTES];

  // designers (all)
  try {
    const { data } = await supabase
      .from("designers")
      .select("slug")
      .eq("is_published", true)
      .not("slug", "is", null);
    for (const d of data ?? []) if (d.slug) paths.push(`/designers/${d.slug}`);
  } catch (_) {}

  // journal (all)
  try {
    const { data } = await supabase
      .from("journal_articles")
      .select("slug")
      .eq("is_published", true)
      .not("published_at", "is", null)
      .not("slug", "is", null);
    for (const a of data ?? []) if (a.slug) paths.push(`/journal/${a.slug}`);
  } catch (_) {}

  // products (sampled — there can be many)
  if (includeProducts) {
    try {
      const { data } = await supabase
        .from("trade_products")
        .select("id")
        .eq("is_active", true)
        .eq("is_hidden", false)
        .limit(sample);
      for (const p of data ?? []) if (p.id) paths.push(`/product/${p.id}`);
    } catch (_) {}
  }

  // dedupe
  const unique = Array.from(new Set(paths));

  const started = Date.now();
  const rows = await pool(unique, CONCURRENCY, (p) => fetchRoute(base, p));
  const elapsedMs = Date.now() - started;

  // duplicate detection
  const titleCounts = new Map<string, number>();
  const descCounts = new Map<string, number>();
  const canonicalCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.title) titleCounts.set(r.title, (titleCounts.get(r.title) ?? 0) + 1);
    if (r.description) descCounts.set(r.description, (descCounts.get(r.description) ?? 0) + 1);
    if (r.canonical) canonicalCounts.set(r.canonical, (canonicalCounts.get(r.canonical) ?? 0) + 1);
  }

  const enriched = rows.map((r) => {
    const issues: string[] = [];
    if (r.status !== 200) issues.push(`http_${r.status || "error"}`);
    if (!r.title) issues.push("missing_title");
    else if ((titleCounts.get(r.title) ?? 0) > 1) issues.push("duplicate_title");
    if (!r.description) issues.push("missing_description");
    else if ((descCounts.get(r.description) ?? 0) > 1) issues.push("duplicate_description");
    if (!r.canonical) issues.push("missing_canonical");
    else {
      if ((canonicalCounts.get(r.canonical) ?? 0) > 1) issues.push("duplicate_canonical");
      if (!r.canonical.endsWith(r.path === "/" ? "/" : r.path) && r.canonical !== `${base}${r.path}` && r.canonical !== `${base}/`) {
        // tolerate trailing-slash differences but flag mismatch
        const expected = `${base}${r.path}`.replace(/\/$/, "");
        const actual = r.canonical.replace(/\/$/, "");
        if (expected !== actual) issues.push("canonical_mismatch");
      }
    }
    return { ...r, issues };
  });

  const summary = {
    base,
    total: enriched.length,
    ok: enriched.filter((r) => r.issues.length === 0).length,
    withIssues: enriched.filter((r) => r.issues.length > 0).length,
    duplicateTitles: [...titleCounts.entries()].filter(([, n]) => n > 1).length,
    duplicateDescriptions: [...descCounts.entries()].filter(([, n]) => n > 1).length,
    duplicateCanonicals: [...canonicalCounts.entries()].filter(([, n]) => n > 1).length,
    elapsedMs,
  };

  return new Response(
    JSON.stringify({ summary, rows: enriched }, null, 2),
    { headers: { ...cors, "content-type": "application/json" } }
  );
});
