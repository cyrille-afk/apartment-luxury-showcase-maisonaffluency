# FurniMesh Integration Plan

Goal: turn any product image into a textured `.glb`, store it alongside existing CAD assets, and let trade + public users orbit/AR-view it in the browser.

## 1. Secret + schema prep

- Add `FURNIMESH_API_KEY` via the secrets tool (user provides it).
- Extend the existing `trade_product_cad_assets.file_format` check constraint to allow `'glb'`, `'gltf'`, `'usdz'`.
- Add two nullable columns:
  - `source_image_url text` — image sent to FurniMesh.
  - `generation_status text` (`pending|ready|failed`) + `generation_job_id text`.
- Storage: create a public bucket `product-3d` for generated GLB/USDZ (small files, served with long cache). RLS: public read, service-role write.

## 2. Edge functions

- **`furnimesh-generate`** (POST, JWT-verified, admin only)
  Input: `{ product_id, image_url, variant_label? }`.
  Flow: insert a `pending` row in `trade_product_cad_assets`, call FurniMesh API with the image URL, store returned `job_id`. Returns the row id.
- **`furnimesh-webhook`** (public, signature-verified)
  On `job.completed`: download the `.glb` (and `.usdz` if returned), upload to `product-3d` bucket under `{product_id}/{asset_id}.glb`, update the row to `ready` with `file_url`, `file_size_bytes`. On failure: mark `failed` with error message.
  *Fallback if FurniMesh has no webhook*: a `furnimesh-poll` cron job that scans `pending` rows every minute.
- **USDZ derivation**: if FurniMesh returns only GLB, queue a second job using their GLB→USDZ converter; otherwise skip (iOS Quick Look will fall back to GLB via model-viewer's auto-conversion not being available — see step 4 note).

## 3. Admin UI — generation entry point

In `src/pages/TradeAdminCadAssets.tsx` (and inline on `TradeProductPage` admin tools):
- "Generate 3D from image" button next to each product image. Opens a small dialog: pick which image, optional variant label, submit → calls `furnimesh-generate`.
- Status badge on the asset row (`pending` spinner, `ready` ✓, `failed` ✗ with retry).

## 4. Viewer — `<model-viewer>` embed

- Add `@google/model-viewer` (web component, ~80 KB gz, lazy-loaded only on product pages that have a `.glb`).
- New component `src/components/trade/Product3DViewer.tsx`:
  ```
  <model-viewer src={glb.url} ios-src={usdz?.url} ar ar-modes="webxr scene-viewer quick-look"
                camera-controls auto-rotate shadow-intensity="1" exposure="1" />
  ```
- Mounted on `TradeProductPage.tsx` as a new tab/section "3D & AR" — visible whenever an active `glb` row exists for the product (or current variant).
- Public product page (`/product/...`) gets the same viewer (no pricing implications). Trade discount logic unaffected.
- USDZ note: if no `.usdz` exists, AR still works on Android via Scene Viewer; iOS Quick Look needs USDZ — show "AR available on Android, generating iOS version…" until USDZ row lands.

## 5. Variant awareness

Reuse the existing variant-image map: when the user picks a finish/variant on the product page that has a matching `variant_label` GLB, swap the `src` on `<model-viewer>`. Falls back to the default (no-variant) GLB.

## 6. Cleanup of leftover OBJ scaffolding

- Drop `'obj'` from the format check constraint (no production rows use it — confirm with a `select count(*)` first; if any exist, keep it).
- Leave `cad-parse-product-asset` + DXF spatial-fit page intact (still useful for floor plans).

## 7. Out of scope (explicit)

- No re-introduction of AI concierge tools for 3D. Viewer is pure UI.
- No client-side mesh editing.
- No mobile-app code (React Native / Flutter) — web only for now; the same `.glb` URLs will work later if you build a native app.

## Technical details

- FurniMesh API: assumed REST endpoint `POST /v1/jobs` with `{ image_url, output: ['glb','usdz'] }` returning `{ job_id }`, plus webhook `POST <our-url>` with `{ job_id, status, assets: [{format,url}] }`. Exact paths confirmed against FurniMesh docs at implementation time; if the API is sync-only, collapse step 2 into a single function.
- Storage path: `product-3d/{product_id}/{asset_id}.{glb|usdz}`. CDN URL stored directly in `file_url`.
- model-viewer loaded via dynamic `import('@google/model-viewer')` to keep the main bundle untouched.
- Edge functions follow project rules: `supabase.auth.getClaims`, CORS headers from `npm:@supabase/supabase-js@2/cors`, Zod validation on inputs.

## Open questions before build

1. Do you already have a FurniMesh account + API key, or should I add the secret request after you sign up?
2. Should generation be **admin-triggered only** (manual button per product), or **auto-batched** across the catalog (cron that picks N products/day)?
3. Should the 3D viewer appear on the **public** product page too, or **trade-only** for now?
