## Goal
Add Jean-Michel Frank's **X Stool (Square), c. 1930** as a curator pick (with product page + dual-axis pricing matrix), register all its finishes in the Fabrics & Finishes library (slicing the crops from the screenshots you uploaded), and also link the four ECRT wood finishes already shown on the **Soleil Coffee Table, c. 1930** so they render on its product page.

## Steps

### 1. Slice swatches from the screenshots
Use Python + Pillow on `/mnt/user-uploads/Screenshot_2026-06-20_at_6.24.36_PM.png` (X Stool board) and `/mnt/user-uploads/Screenshot_2026-06-20_at_6.24.15_PM.png` (Soleil board). For each labelled tile, crop the swatch area, save as JPG, and upload to Supabase storage bucket `swatches/` (or reuse the existing assets bucket). Capture public URLs.

Tiles to extract:
- **X Stool fabrics/leathers/hide**: Marie-Laure Greige, Marie-Laure Green, Margareta Grey, Margareta Ocre, Oatmeal Shearling, Oatmeal White, Cognac leather, Dark chocolate leather, Black leather, Hide.
- **X Stool wood codes** (frame variants): ECRT-CH-7, ECRT-CH-9, ECRT-CH-8, ECRT-CH-12, ECRT-CH-14, ECRT-CH-13, ECRT-CH-17, ECRT-CH-16, ECRT-CH-15.
- **Soleil wood codes**: ECRT-CH-7, ECRT-CH-9, ECRT-CH-8, ECRT-MA-29 (re-use the CH-7/8/9 crops from above so they share one library entry).

### 2. Top up the Fabrics library
For each missing entry insert into `public.fabrics` with `supplier='Ecart Paris'`:
- New entries: **Oatmeal White** (tier blank, no per-lm price), **ECRT-CH-7/8/9/12/13/14/15/16/17**, **ECRT-MA-29** (wood swatches — no tier, no per-lm price; they're frame finishes included in the pick's matrix price).
- Skip entries already present (Marie-Laure Greige/Green, Margareta Grey/Ocre, Oatmeal Shearling, Cognac/Dark chocolate/Black leather, Hide).
- Update existing rows whose `image_url` is blank with the new sliced URLs (so existing X Stool Round / Croisillon picks benefit too).

### 3. Create the X Stool (Square) c. 1930 curator pick
Insert into `designer_curator_picks` for designer **Jean-Michel Frank** (`f44b5dca-…`):
- `title = "X Stool (Square) c. 1930"`
- `dimensions = "H 43 × W 51 × D 39 cm"`
- `base_axis_label = "Frame"`, `top_axis_label = "Upholstery"`
- `size_variants` (10 combos, EUR cents):

```text
Frame             Upholstery       Price
Smooth Oak        ECART fabric     350000
Smooth Oak        COM fabric       350000
Smooth Oak        Leather          380000
Smooth Oak        Hide             390000
Smooth Oak        Shearling        400000
Sandblasted Oak   ECART fabric     350000
Sandblasted Oak   COM fabric       350000
Sandblasted Oak   Leather          390000
Sandblasted Oak   Hide             400000
Sandblasted Oak   Shearling        410000
```

- `image_url` / `gallery_images`: use the stool crop from the X Stool screenshot as the hero (sliced to ~square), with the two frame swatches (CH-7, CH-9 representing Smooth, plus CH-15/16/17 family for Sandblasted) as gallery images. If you'd prefer a clean studio photo, flag and I'll wait.
- `materials = "Varnished oak & hide, fabric, leather or shearling."`
- `currency = "EUR"`, `price_prefix = "From"`.

### 4. Link finishes to both picks via `product_fabrics`
- **X Stool (Square)**: link all 10 fabric/leather/hide rows (upholstery axis) and the 9 ECRT-CH wood rows (frame swatches). Use `image_indices` to anchor swatches to the gallery slot, `sort_order` to follow the screenshot order. Trigger `refresh_product_fabric_swatches_public` fires automatically.
- **Soleil Coffee Table c. 1930** (`b8b26623-…`): link 4 wood rows (ECRT-CH-7, ECRT-CH-9, ECRT-CH-8, ECRT-MA-29) as frame finishes.

### 5. Verify
- Re-query `product_fabric_swatches_public` for both picks to confirm 19 entries on X Stool Square and 4 on Soleil.
- Open `/trade/products/jean-michel-frank/x-stool-square-c-1930` and `/trade/products/jean-michel-frank/soleil-coffee-table-c-1930` in preview + screenshot to confirm swatches and the Frame / Upholstery dropdowns render with the dimension Ruler icon and `cm | "` formatting.

## Open assumptions (will proceed unless you object)
- Soleil keeps its existing 2-row Size × Finish matrix; we only add wood swatches to its Finishes strip, no price change.
- All 10 X Stool prices are MSRP/RRP in EUR; the standard 8% trade discount applies automatically via `trade_price_cents`.
- Wood ECRT codes are stored as `fabrics` rows (same library) with no tier/price — they render as swatches but never appear in fabric upcharge math.
