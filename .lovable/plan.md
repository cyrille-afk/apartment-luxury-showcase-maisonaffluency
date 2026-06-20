## Goal
Re-audit every catalog item reachable from a `gallery_hotspots` row (via `mapped_pick_id` or fuzzy match) and verify three rules, then list and fix offenders.

## Rules to enforce
1. **Dimensions dropdown** — every mapped pick that has more than one size must populate `size_variants` (so the product page renders the Base/Top dropdowns). Picks with sizes baked only into the `dimensions` string get flagged for variant extraction.
2. **Units** — every dimension string (`dimensions`, each `size_variants[].label`/`base`/`top`) ends in `cm` (or `mm`). No raw `in` / `inch` tokens. Imperial conversion is rendered by `withImperialPerLine` and must output the `"` mark — never `in`.
3. **Icon** — the dimension icon on Public/Trade product pages comes from `SpecGlyph` with `symbol="📐"`, which must render the Lucide `Ruler` (same as Compare drawer, Rug picker, Trade spec tools).

## Steps

### A. Code sweep (instant fixes)
- Confirm `src/components/product/SpecGlyph.tsx` `📐` branch returns `<Ruler />` — already true; assert no stray hardcoded `📐` emojis or `<Triangle />` fallbacks remain on hotspot-reachable pages (`PublicProductPage`, `ProductPage`, `TradeProductPage`, `PublicProductLightbox`, `TradeProductLightbox`, `CompareDrawer`).
- Grep for `" in"` / `"inch"` literals in the dimension render path and replace with the `"` mark via `withImperialPerLine`.

### B. Data audit (one read-only SQL pass)
Run a query joining `gallery_hotspots` → `designer_curator_picks` (preferring `mapped_pick_id`, falling back to title match) and bucket rows by:

```text
hotspot_id | pick_id | product | designer | issue
-----------+--------+---------+----------+------------------------------------
           |        |         |          | NO_VARIANTS  (multi-size pick, empty size_variants)
           |        |         |          | BAD_UNIT     (dimensions/variant labels missing cm/mm)
           |        |         |          | STRAY_IN     (contains "in" / "inch" tokens)
           |        |         |          | NO_PICK      (unmapped + no fuzzy match)
```

Output the full table to chat so you can pick which to fix.

### C. Fixes
- `STRAY_IN` / `BAD_UNIT` → SQL `UPDATE` on `designer_curator_picks.dimensions` / `size_variants` to normalize to `cm`.
- `NO_VARIANTS` → propose `size_variants` arrays per pick (with `price_cents` left at current value) for your approval before insert.
- `NO_PICK` → list in chat; you decide whether to map via the existing bulk tool at `/trade/admin/hotspot-mapping`.
- Icon/unit-render code fixes (if any found in step A) get patched directly.

### D. Verify
- Re-run the audit query — every bucket must return 0 rows except `NO_PICK` (which only you can resolve).
- Spot-check one mapped product page in the preview to confirm the Ruler icon and `"` mark render.

## Deliverable
A chat report with the audit table, the SQL/code patches applied, and a final clean re-audit.
