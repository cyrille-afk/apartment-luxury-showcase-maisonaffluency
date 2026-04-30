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
  const force = !!body.force;
  const maxRescrapes = Math.max(1, Math.min(1000, body.maxRescrapes ?? DEFAULT_MAX));

  try {
    const [paths, buildId, prev] = await Promise.all([
      fetchManifest(),
      fetchBuildId(),
      fetchSnapshot(),
    ]);

    // Same build as last run AND not forced → nothing to do.
    if (!force && buildId && prev.buildId === buildId) {
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
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
    return jsonResp({ error: e?.message ?? String(e) }, 500);
  }
});
