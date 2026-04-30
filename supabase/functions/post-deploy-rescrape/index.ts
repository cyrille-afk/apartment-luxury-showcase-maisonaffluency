/**
 * post-deploy-rescrape
 * ====================
 *
 * Tells Meta's Sharing Debugger that our OG bridges changed, so WhatsApp,
 * Facebook, Messenger, Threads and Instagram drop their cached OG card and
 * re-fetch the new one.
 *
 * How a deploy gets here:
 *
 *  1. Build emits an updated /og-manifest.json (list of all bridge paths).
 *  2. The in-app build-version watcher detects the new buildId and fires a
 *     fire-and-forget POST to this function (no auth needed; the function
 *     is rate-limited and idempotent).
 *  3. As a safety net, a nightly cron also calls this function so deploys
 *     made while no users were on the site still get rescraped within 24 h.
 *
 * What this function does:
 *
 *  - Loads /og-manifest.json from the live site.
 *  - Loads the previous snapshot from assets/og/_meta/snapshot.json
 *    (contains { path: ogImageUrl } for the last deploy we processed).
 *  - For each manifest entry, fetches the bridge HTML and extracts its
 *    current og:image. Builds a fresh snapshot.
 *  - Diff = entries whose og:image changed + brand-new entries. Capped at
 *    `maxRescrapes` per run (default 250) to stay polite with Meta's API.
 *  - Calls the existing `rescrape-og` function with the diff.
 *  - Saves the fresh snapshot back to storage.
 *
 *  POST { force?: true, maxRescrapes?: 250 }
 *    force=true   → ignore snapshot, rescrape every bridge in the manifest
 *                   (used by the manual "Rescrape all" admin button)
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE_BASE = "https://www.maisonaffluency.com";
const SNAPSHOT_BUCKET = "assets";
const SNAPSHOT_PATH = "og/_meta/snapshot.json";
const SNAPSHOT_PUBLIC_URL =
  `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/${SNAPSHOT_BUCKET}/${SNAPSHOT_PATH}`;
const DEFAULT_MAX = 250;
const FETCH_CONCURRENCY = 16;

type Snapshot = { buildId?: string; entries: Record<string, string> };

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const OG_RE =
  /<meta\s+property="og:image"\s+content="([^"]+)"/i;

async function fetchManifest(): Promise<string[]> {
  const r = await fetch(`${SITE_BASE}/og-manifest.json?t=${Date.now()}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`og-manifest.json: ${r.status}`);
  const data = await r.json();
  if (!Array.isArray(data)) throw new Error("og-manifest.json is not an array");
  return data;
}

async function fetchBuildId(): Promise<string | null> {
  try {
    const r = await fetch(`${SITE_BASE}/version.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data?.buildId ?? null;
  } catch {
    return null;
  }
}

async function fetchSnapshot(): Promise<Snapshot> {
  try {
    const r = await fetch(`${SNAPSHOT_PUBLIC_URL}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!r.ok) return { entries: {} };
    return (await r.json()) as Snapshot;
  } catch {
    return { entries: {} };
  }
}

async function extractOgImage(path: string): Promise<[string, string | null]> {
  try {
    const r = await fetch(`${SITE_BASE}/${path}`, {
      cache: "no-store",
      headers: {
        // Meta's UA so the bridge serves the static OG HTML (the redirect
        // script targets non-bots only).
        "User-Agent": "facebookexternalhit/1.1",
        Accept: "text/html",
      },
    });
    if (!r.ok) return [path, null];
    const html = await r.text();
    const m = OG_RE.exec(html);
    return [path, m?.[1] ?? null];
  } catch {
    return [path, null];
  }
}

async function buildCurrentSnapshot(paths: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  // Bounded concurrency
  let cursor = 0;
  async function worker() {
    while (cursor < paths.length) {
      const idx = cursor++;
      const [p, img] = await extractOgImage(paths[idx]);
      if (img) result[p] = img;
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, paths.length) }, worker),
  );
  return result;
}

function diffSnapshots(
  prev: Record<string, string>,
  next: Record<string, string>,
): string[] {
  const changed: string[] = [];
  for (const [path, img] of Object.entries(next)) {
    if (prev[path] !== img) changed.push(path);
  }
  return changed;
}

async function callRescrape(urls: string[]) {
  if (urls.length === 0) return { success: 0, failed: 0, total: 0 };
  const r = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/rescrape-og`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
      },
      body: JSON.stringify({ urls }),
    },
  );
  const data = await r.json().catch(() => ({}));
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")
    return new Response("method not allowed", { status: 405, headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const mode = typeof body.mode === "string" ? body.mode : "rescrape";
  const force = !!body.force;
  const triggerSource = typeof body.triggerSource === "string" ? body.triggerSource : "unknown";
  const maxRescrapes = Math.max(1, Math.min(1000, body.maxRescrapes ?? DEFAULT_MAX));

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const logRun = async (row: Record<string, unknown>) => {
    try {
      await supabase.from("og_rescrape_runs").insert(row);
    } catch (e) {
      console.error("failed to log og_rescrape_runs", e);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // INSPECT MODE: { mode: "inspect", url: "<bridge url or path>" }
  // Returns the bridge's current og:image, image byte size, and
  // the snapshot's last-known og:image for that bridge.
  // ─────────────────────────────────────────────────────────────
  if (mode === "inspect") {
    try {
      const raw = String(body.url ?? "").trim();
      if (!raw) return jsonResp({ error: "url required" }, 400);

      // Normalize → path relative to SITE_BASE
      let path = raw;
      try {
        if (/^https?:\/\//i.test(raw)) {
          const u = new URL(raw);
          path = u.pathname.replace(/^\/+/, "");
        }
      } catch { /* keep as-is */ }
      path = path.replace(/^\/+/, "");

      const [, ogImage] = await extractOgImage(path);

      // Probe the og:image for size
      let imageBytes: number | null = null;
      let imageContentType: string | null = null;
      let imageStatus: number | null = null;
      if (ogImage) {
        try {
          const head = await fetch(ogImage, { method: "HEAD" });
          imageStatus = head.status;
          imageContentType = head.headers.get("content-type");
          const len = head.headers.get("content-length");
          imageBytes = len ? parseInt(len, 10) : null;
          if (imageBytes === null) {
            const get = await fetch(ogImage);
            const buf = await get.arrayBuffer();
            imageBytes = buf.byteLength;
          }
        } catch (e) {
          console.error("og image probe failed", e);
        }
      }

      const snapshot = await fetchSnapshot();
      const previousOgImage = snapshot.entries?.[path] ?? null;

      return jsonResp({
        ok: true,
        path,
        bridgeUrl: `${SITE_BASE}/${path}`,
        ogImage,
        previousOgImage,
        changedSinceSnapshot: previousOgImage !== ogImage,
        imageBytes,
        imageContentType,
        imageStatus,
        compliant:
          imageBytes !== null && imageBytes <= 300 * 1024 &&
          (imageContentType?.includes("image/") ?? false),
      });
    } catch (e: any) {
      return jsonResp({ error: e?.message ?? String(e) }, 500);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // RESCRAPE-ONE MODE: { mode: "rescrape-one", url: "..." }
  // Forces a single bridge to be rescraped via Meta.
  // ─────────────────────────────────────────────────────────────
  if (mode === "rescrape-one") {
    try {
      const raw = String(body.url ?? "").trim();
      if (!raw) return jsonResp({ error: "url required" }, 400);
      let path = raw;
      try {
        if (/^https?:\/\//i.test(raw)) {
          const u = new URL(raw);
          path = u.pathname.replace(/^\/+/, "");
        }
      } catch { /* keep */ }
      path = path.replace(/^\/+/, "");
      const fullUrl = `${SITE_BASE}/${path}`;
      const result = await callRescrape([fullUrl]);
      await logRun({
        trigger_source: triggerSource || "admin-inspect",
        rescraped_count: 1,
        forced: true,
        rescrape_result: { single: path, result },
      });
      return jsonResp({ ok: true, url: fullUrl, result });
    } catch (e: any) {
      return jsonResp({ error: e?.message ?? String(e) }, 500);
    }
  }



  try {
    const [paths, buildId, prev] = await Promise.all([
      fetchManifest(),
      fetchBuildId(),
      fetchSnapshot(),
    ]);

    // Same build as last run AND not forced → nothing to do.
    if (!force && buildId && prev.buildId === buildId) {
      await logRun({
        trigger_source: triggerSource,
        build_id: buildId,
        manifest_size: paths.length,
        previous_snapshot_size: Object.keys(prev.entries ?? {}).length,
        rescraped_count: 0,
        forced: force,
        skipped: true,
        skipped_reason: "same buildId as last snapshot",
      });
      return jsonResp({
        skipped: true,
        reason: "same buildId as last snapshot",
        buildId,
        manifestSize: paths.length,
      });
    }

    const current = await buildCurrentSnapshot(paths);
    let toRescrape = force
      ? Object.keys(current)
      : diffSnapshots(prev.entries ?? {}, current);

    let truncated = false;
    if (toRescrape.length > maxRescrapes) {
      truncated = true;
      toRescrape = toRescrape.slice(0, maxRescrapes);
    }

    const urls = toRescrape.map((p) => `${SITE_BASE}/${p}`);
    const rescrapeResult = await callRescrape(urls);

    // Persist new snapshot (always, so subsequent runs can diff)
    const newSnapshot: Snapshot = {
      buildId: buildId ?? undefined,
      entries: current,
    };
    const { error: upErr } = await supabase.storage
      .from(SNAPSHOT_BUCKET)
      .upload(SNAPSHOT_PATH, JSON.stringify(newSnapshot), {
        contentType: "application/json",
        upsert: true,
        cacheControl: "60",
      });
    if (upErr) {
      console.error("snapshot upload failed", upErr);
    }

    await logRun({
      trigger_source: triggerSource,
      build_id: buildId,
      manifest_size: paths.length,
      current_snapshot_size: Object.keys(current).length,
      previous_snapshot_size: Object.keys(prev.entries ?? {}).length,
      rescraped_count: toRescrape.length,
      forced: force,
      truncated,
      skipped: false,
      rescrape_result: rescrapeResult,
    });

    return jsonResp({
      ok: true,
      buildId,
      manifestSize: paths.length,
      currentSnapshotSize: Object.keys(current).length,
      previousSnapshotSize: Object.keys(prev.entries ?? {}).length,
      rescrapedCount: toRescrape.length,
      truncated,
      rescrapeResult,
    });
  } catch (e: any) {
    console.error("post-deploy-rescrape error", e);
    await logRun({
      trigger_source: triggerSource,
      forced: force,
      rescraped_count: 0,
      error: e?.message ?? String(e),
    });
    return jsonResp({ error: e?.message ?? String(e) }, 500);
  }
});
