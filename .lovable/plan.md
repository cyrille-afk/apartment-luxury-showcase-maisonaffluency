# Edge caching for the public catalogue

## What already exists

- `catalog-manifest` edge function serves the anonymous catalogue (picks + designers) over a plain cacheable GET with `public, max-age=60, s-maxage=300, stale-while-revalidate=86400`.
- `scripts/build-catalog-manifest.mjs` writes a build-time `/catalog-manifest.json` that is tried first (same-origin static asset, no database hit).
- Only the homepage Gallery consumes it. Every other public surface (browse grid, designers directory, designer profile, product pages) still queries Postgres directly from the browser on every anonymous visit.

So the gap is not "no cache layer" — it is coverage, the cache window, and the missing authenticated bypass.

## 1. Cache headers

Add `supabase/functions/_shared/publicCache.ts` with one shared header builder:

- Anonymous request: `Cache-Control: public, max-age=60, s-maxage=3600, stale-while-revalidate=86400`, `Vary: Accept-Encoding, Authorization`.
- Error responses: `no-store` (unchanged).

Bump `catalog-manifest` from `s-maxage=300` to `3600` and adopt the shared builder.

## 2. Authenticated bypass

The same builder inspects the incoming `Authorization` bearer token and decodes its `role` claim:

- token absent, or role `anon` → cacheable headers above.
- role `authenticated` (a signed-in trade designer) → `Cache-Control: no-store, private`, no shared cache entry, and the function serves the request with the caller's JWT so RLS applies their pricing visibility.

`Vary: Authorization` guarantees a CDN can never hand a cached anonymous payload to a logged-in trade user.

## 3. Route the remaining public surfaces through the cached feed

Add `src/lib/catalogSource.ts` — one entry point that returns catalogue rows from the manifest for anonymous visitors and falls through to the existing direct Supabase queries when a trade session is present.

Rewire:

- `useDbCuratorPicks` (browse grid) — build its items from the manifest instead of `designer_curator_picks_public` + `designers`; dedupe/sort logic stays untouched.
- `DesignersDirectory` — its three designer/pick roll-up queries.
- `publicProductPageQuery` — resolve the designer's picks list from the manifest; keep the heavy per-product detail fields on a direct query (single row, low volume).

Trade routes and anything showing Studio pricing keep their current direct queries — no behaviour change there.

## 4. Static / incremental generation

This app is a Vite SPA, so there is no framework-level static or incremental page generation to enable. The equivalent already in place is the build-time `/catalog-manifest.json` served as a static CDN asset, which will now back every public catalogue surface rather than only the homepage. Real per-page server rendering would need the TanStack Start template — [what the upgrade gives you](https://lovable.dev/blog/building-apps-using-tanstack-start) — not part of this work.

## 5. Verification

- Unit tests for the header builder (anon vs authenticated) and for manifest → grid-item mapping.
- `curl -I` the deployed function with no token and with a trade user token, confirming the two header sets.
- Browser check: anonymous browse grid and a designer profile render correctly from the manifest; a signed-in trade user still sees their pricing.
