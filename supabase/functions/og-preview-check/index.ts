// Share preview tester: fetches an arbitrary URL with social-crawler UAs
// (Facebook, WhatsApp), parses OG/Twitter tags, and HEAD-checks the image
// for the kind of issues that break previews (404, wrong MIME, oversize).

const TIMEOUT_MS = 12000;

const UA_FB = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const UA_WA = "WhatsApp/2.24.0.78 A";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
   .replace(/&lt;/g, "<").replace(/&gt;/g, ">");

function parseHead(html: string) {
  const og: Record<string, string> = {};
  const tw: Record<string, string> = {};
  const reProp = /<meta[^>]+property=["']([^"']+)["'][^>]*content=["']([^"']*)["']/gi;
  const reName = /<meta[^>]+name=["']([^"']+)["'][^>]*content=["']([^"']*)["']/gi;
  // Also accept content-before-property/name orderings
  const reProp2 = /<meta[^>]+content=["']([^"']*)["'][^>]*property=["']([^"']+)["']/gi;
  const reName2 = /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = reProp.exec(html))) { if (m[1].startsWith("og:")) og[m[1]] = decode(m[2]); }
  while ((m = reProp2.exec(html))) { if (m[2].startsWith("og:") && !og[m[2]]) og[m[2]] = decode(m[1]); }
  while ((m = reName.exec(html))) { if (m[1].startsWith("twitter:")) tw[m[1]] = decode(m[2]); }
  while ((m = reName2.exec(html))) { if (m[2].startsWith("twitter:") && !tw[m[2]]) tw[m[2]] = decode(m[1]); }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i);
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  return {
    og,
    tw,
    title: titleMatch ? decode(titleMatch[1].trim()) : "",
    description: descMatch ? decode(descMatch[1]) : "",
    canonical: canonicalMatch ? decode(canonicalMatch[1]) : "",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAs(url: string, ua: string, retry404 = true) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": ua, "accept": "text/html,*/*", "cache-control": "no-cache" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    const finalUrl = res.url;
    const status = res.status;
    const ct = res.headers.get("content-type") ?? "";
    if (status === 404 && retry404) {
      clearTimeout(t);
      await sleep(1000);
      return fetchAs(url, ua, false); // one retry only
    }
    const html = ct.includes("text/") || ct.includes("html") ? await res.text() : "";
    return { status, contentType: ct, finalUrl, html, bytes: html.length };
  } catch (e) {
    return { status: 0, contentType: "", finalUrl: url, html: "", bytes: 0, error: (e as Error).message };
  } finally {
    clearTimeout(t);
  }
}

async function checkImage(url: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "user-agent": UA_WA, "range": "bytes=0-0" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    const ct = res.headers.get("content-type") ?? "";
    const cr = res.headers.get("content-range") ?? "";
    const cl = res.headers.get("content-length") ?? "";
    // content-range: "bytes 0-0/12345" — extract total
    let totalBytes: number | undefined;
    const crMatch = cr.match(/\/(\d+)$/);
    if (crMatch) totalBytes = parseInt(crMatch[1], 10);
    else if (cl && res.status === 200) totalBytes = parseInt(cl, 10);
    return {
      status: res.status,
      contentType: ct,
      sizeKb: totalBytes ? Math.round(totalBytes / 1024) : undefined,
      ok: (res.status === 200 || res.status === 206) && ct.startsWith("image/"),
    };
  } catch (e) {
    return { status: 0, contentType: "", ok: false, error: (e as Error).message };
  } finally {
    clearTimeout(t);
  }
}

function analyze(parsed: ReturnType<typeof parseHead>) {
  const issues: string[] = [];
  const warnings: string[] = [];
  const { og } = parsed;
  if (!og["og:title"]?.trim()) issues.push("missing og:title");
  if (!og["og:image"]?.trim()) issues.push("missing og:image (no preview will render)");
  if (!og["og:url"]?.trim()) warnings.push("missing og:url");
  if (!og["og:type"]) warnings.push("missing og:type");
  if (!og["og:description"]) warnings.push("missing og:description");
  if (!og["og:image:width"] || !og["og:image:height"]) warnings.push("missing og:image dimensions");
  if (og["og:image"] && /^http:\/\//i.test(og["og:image"])) warnings.push("og:image is http (use https)");
  return { issues, warnings };
}

import { requireAdmin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Admin-only: this function fetches arbitrary caller-supplied URLs and
  // would otherwise be an open SSRF proxy reachable from the public internet.
  const auth = await requireAdmin(req, "og-preview-check");
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { ...cors, "content-type": "application/json" },
    });
  }

  let target = "";
  try {
    if (req.method === "POST") {
      const body = await req.json();
      target = String(body?.url ?? "");
    } else {
      target = new URL(req.url).searchParams.get("url") ?? "";
    }
  } catch { /* ignore */ }

  if (!target || !/^https?:\/\//i.test(target)) {
    return new Response(JSON.stringify({ error: "Provide a full http(s) URL" }), {
      status: 400, headers: { ...cors, "content-type": "application/json" },
    });
  }

  const started = Date.now();
  const [fb, wa] = await Promise.all([fetchAs(target, UA_FB), fetchAs(target, UA_WA)]);

  const primary = fb.html ? fb : wa;
  const parsed = parseHead(primary.html);
  const { issues, warnings } = analyze(parsed);

  let imageCheck: Awaited<ReturnType<typeof checkImage>> | null = null;
  if (parsed.og["og:image"]) {
    imageCheck = await checkImage(parsed.og["og:image"]);
    if (!imageCheck.ok) issues.push(`og:image fetch failed (HTTP ${imageCheck.status || "ERR"} ${imageCheck.contentType || ""})`);
    if (imageCheck.sizeKb && imageCheck.sizeKb > 8000) issues.push(`og:image too large (${imageCheck.sizeKb} KB — Facebook caps ~8 MB, WhatsApp ~300 KB)`);
    else if (imageCheck.sizeKb && imageCheck.sizeKb > 300) warnings.push(`og:image is ${imageCheck.sizeKb} KB — WhatsApp recommends ≤300 KB`);
  }

  const wouldRender = !!parsed.og["og:image"] && (imageCheck?.ok ?? false) && !!parsed.og["og:title"];

  return new Response(JSON.stringify({
    requestedUrl: target,
    elapsedMs: Date.now() - started,
    wouldRender,
    issues,
    warnings,
    facebook: { status: fb.status, finalUrl: fb.finalUrl, contentType: fb.contentType, bytes: fb.bytes, error: (fb as any).error },
    whatsapp: { status: wa.status, finalUrl: wa.finalUrl, contentType: wa.contentType, bytes: wa.bytes, error: (wa as any).error },
    parsed,
    imageCheck,
  }, null, 2), {
    headers: { ...cors, "content-type": "application/json" },
  });
});
