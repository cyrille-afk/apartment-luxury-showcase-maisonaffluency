// Single entry point for public catalogue reads.
//
// Anonymous visitors are served from the edge-cached catalog manifest
// (static /catalog-manifest.json first, then the CDN-cached `catalog-manifest`
// edge function) so the public catalogue never touches Postgres per visitor.
//
// Signed-in trade users bypass the cache entirely and keep their existing
// direct Supabase queries, so Studio pricing / RLS visibility is untouched.

import { supabase } from "@/integrations/supabase/client";
import {
  fetchCatalogManifest,
  type CatalogManifest,
  type CatalogManifestPick,
  type CatalogManifestDesigner,
} from "@/lib/catalogManifest";

const MANIFEST_TTL_MS = 5 * 60_000;

let cached: { at: number; promise: Promise<CatalogManifest> } | null = null;

/** Memoised manifest fetch — one network request per tab per TTL window. */
export function getCatalogManifest(): Promise<CatalogManifest> {
  const now = Date.now();
  if (cached && now - cached.at < MANIFEST_TTL_MS) return cached.promise;
  const promise = fetchCatalogManifest().catch((err) => {
    // Never poison the cache with a failed fetch.
    cached = null;
    throw err;
  });
  cached = { at: now, promise };
  return promise;
}

/** Test/HMR helper. */
export function resetCatalogManifestCache() {
  cached = null;
}

/**
 * True when the visitor has a real session (trade user). Those requests must
 * bypass the shared cache so they always read live, permission-scoped rows.
 */
export async function hasActiveSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data.session?.access_token);
  } catch {
    return false;
  }
}

export interface CatalogSnapshot {
  picks: CatalogManifestPick[];
  designers: CatalogManifestDesigner[];
}

/**
 * Returns the cached catalogue for anonymous visitors, or `null` when the
 * caller must fall through to a direct (uncached) database query.
 */
export async function getCachedCatalog(): Promise<CatalogSnapshot | null> {
  if (await hasActiveSession()) return null;
  try {
    const manifest = await getCatalogManifest();
    if (!manifest?.picks?.length || !manifest?.designers?.length) return null;
    return { picks: manifest.picks, designers: manifest.designers };
  } catch {
    return null;
  }
}
