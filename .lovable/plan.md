## Goal

One product page, two surfaces. Variant axes always show Base **and** Top — when an axis has only one option it renders as a locked row, not a hidden dropdown.

## Scope

In:
- New `src/pages/ProductPage.tsx` with `mode: "public" | "trade"`.
- Variant selector rewrite so dual-axis always renders both axes.
- Routing: both `/:designerSlug/:productSlug` and `/trade/products/:designerSlug/:productSlug` (and `/trade/products/:id`) point at the unified page.

Out:
- No data migrations. `size_variants`, `base_axis_label`, `top_axis_label` stay as-is.
- No pricing/FX logic changes. No tearsheet/quote changes.
- No public/trade access-control changes (mode controls UI only; auth gates still applied where they exist).

## Architecture

```text
src/pages/ProductPage.tsx              (new — orchestrator, mode-aware)
src/pages/product/
  useProductData.ts                    (data fetch: shared, branches on mode for pricing fields)
  ProductHeader.tsx                    (title, breadcrumbs, share)
  ProductGallery.tsx                   (existing gallery wrapper, mode-aware hotspots)
  ProductVariantPanel.tsx              (new — always-both-axes selectors)
  ProductPricingBlock.tsx              (mode="public" → "Price on Request"; mode="trade" → trade/RRP + FX)
  ProductCTABlock.tsx                  (public → Request Quote modal; trade → Add to Quote / Tearsheet)
  ProductSpecBlock.tsx                 (shared)
  ProductRelated.tsx                   (shared)
src/pages/PublicProductPage.tsx        → 6-line shim: <ProductPage mode="public" />
src/pages/TradeProductPage.tsx        → 6-line shim: <ProductPage mode="trade" />
```

Existing routes keep working via the shims. Once verified, the shims can be deleted in a follow-up.

## Variant panel behaviour (the user-visible fix)

Detection (unchanged): `isDualAxis = hasAnyBase && hasAnyTop` from `computeVariantAxes`.

New rendering rule when `isDualAxis`:

| Base options | Top options | Render                                                                              |
| ------------ | ----------- | ----------------------------------------------------------------------------------- |
| 1            | 1           | Two locked rows: "Base: Aged Brass" / "Top: Onice Velluto"                          |
| 1            | 2+          | Locked Base row + Top dropdown                                                      |
| 2+           | 1           | Base dropdown + locked Top row                                                      |
| 2+           | 2+          | Base dropdown + Top dropdown (today's behaviour for multi-base × multi-top)         |

Locked row = label chip ("Base: Aged Brass") styled like a disabled select so it visually signals "this axis exists but isn't a choice". No interaction.

Axis label fallbacks: `base_axis_label` → "Base", `top_axis_label` → "Top". `wood_label_override` still wins on the swatch picker side.

Single-axis products (`label` only, no base/top) unchanged. Rug per-sqm picker unchanged. `FinishSelector` for upholstery / linked wood swatches unchanged — the new panel sits alongside it, not inside it.

## Mode-specific differences (kept minimal)

| Concern              | public mode                  | trade mode                                    |
| -------------------- | ---------------------------- | --------------------------------------------- |
| Price                | "Price on Request"           | Trade price (RRP strikethrough if discounted) |
| Currency switcher    | hidden                       | shown                                         |
| CTA                  | Request Quote modal          | Add to Quote / Tearsheet / Sample             |
| Spec sheet PDF       | gated (registration wall)    | direct download                               |
| Breadcrumb root      | `/`                          | `/trade/products`                             |
| Lead time / origin   | shown                        | shown + stock status override                 |
| Trade-only sections  | hidden (CAD, payout, Stripe) | shown                                         |

All other UI — gallery, hotspots, materials, dimensions, related products, share bridge, JSON-LD — identical.

## Implementation steps

1. Lift `computeVariantAxes` consumers into `ProductVariantPanel.tsx` and write the new render table above. Add `__tests__/ProductVariantPanel.locked-axis.test.tsx` covering all four base×top combinations.
2. Extract data fetch from both existing pages into `useProductData(mode, params)`. Return a normalised `Product` shape; mode only affects which pricing/CAD fields are selected.
3. Move shared subcomponents (header, gallery wrapper, spec block, related) into `src/pages/product/`.
4. Build `ProductPage.tsx` that composes them and forwards `mode`.
5. Replace `PublicProductPage.tsx` and `TradeProductPage.tsx` bodies with the 6-line shims. Keep their exports and file paths so routing doesn't move.
6. Manual verification on the Madison Avenue Side Table URL on both surfaces — expect Base row (locked, "Aged Brass") + Top dropdown (Onice / Pakistani).

## Risk + verification

- Highest blast radius: `TradeProductPage.tsx` (2157 lines) holds quote/CAD/FX logic. Moving it wholesale risks regressions in quoting and tearsheet flows.
- Mitigation: shims keep both routes mounting the same component; mode flags isolate trade-only blocks; no logic deleted, only relocated.
- Verify after build: open Madison Avenue on `/man-of-parts/...` and `/trade/products/man-of-parts/...`, screenshot both, confirm Base + Top render identically. Then spot-check one upholstered product (FinishSelector path), one rug (per-sqm path), one true 2×2 product (Standby Side Table per memory), and one single-axis product.

## Out of scope (callouts so we don't drift)

- No change to `designer_curator_picks` / `trade_products` schema.
- No change to curator-pick → trade-product sync trigger.
- No change to public registration gate on PDFs.
- No change to OG bridges or SEO meta.
