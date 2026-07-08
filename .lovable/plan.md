## Goal

Right now every non-fabric material in a GLB is tagged as **base**, so a single "wood & base" swatch retextures both the base cube and the marble top of the Madison Avenue Side Table (and any similar piece). Introduce a third role, **top**, that is styled by its own swatch stream so the base and the top can be picked independently.

No database schema change is needed — `trade_product_glb_variants.material_roles` is already a free-form JSONB map, so `"top"` becomes just another valid value alongside `"fabric" | "base" | "ignore"`.

## Changes

**1. `Product3DViewer.tsx`**
- Extend the `MaterialRole` union to `"fabric" | "base" | "top" | "ignore"`.
- Add two new props: `topTextureUrl?: string | null` and `topMaterialNameIncludes?: string | string[]`.
- Filter a third `topMatched` array from the explicit role map (or new keyword group: `top, tabletop, surface, marble, stone, glass`).
- Apply/restore a third texture layer identical to the fabric/base plumbing.
- Extend the debug banner to `fabric N · base N · top N / total` so the admin can see the classification.

**2. `GlbMaterialRolesEditor.tsx`**
- Add a fourth button in `ROLE_ORDER`: `top` with label "Top (stone · marble · glass)".
- Orange for base stays; use a distinct colour (e.g. `bg-sky-700`) for the top button so the two are visually separable.
- No other behavioural change — the identify flow still repurposes the "fabric" slot for the magenta highlight.

**3. `TradeProductPage.tsx`**
- Pass the current top-swatch selection through to `Product3DViewer` as `topTextureUrl`. For the first pass I'll wire it to the existing `selectedWoodPrice` fallback so nothing regresses if no top swatch is chosen yet, and expose a new `selectedTopFinish` state driven by a dedicated "Top finishes" swatch row rendered directly below the existing "Wood & base finishes" row when the resolved variant has any material tagged `"top"`.
- The new row reuses the existing `product_fabric_swatches_public` swatch UI component — the same picker used for wood/base — filtered to swatches flagged as `role = 'top'` (or, until data is tagged, mirroring the wood swatch list so the admin can start experimenting).
- Update the `resolvedRoles` type to include the new `"top"` value.

**4. Admin variant manager (`GlbVariantManager.tsx`)**
- Update the `MaterialRole` import/type to include `"top"`.
- No functional change — the identify override still maps a single material into the fabric slot; other materials become `"ignore"` during identify, which is unchanged.

**5. Docs / no DB migration**
- Confirm no migration is needed. The JSONB column already accepts arbitrary strings and no CHECK constraint enforces the current union.

## Technical notes

```text
GLB material                role (admin)     texture source at runtime
────────────────────────────────────────────────────────────────────
9b243aed-e0d... (base cube) base             baseTextureUrl  (wood/base swatch)
96541480-d12... (marble top) top             topTextureUrl   (top swatch)
```

## Out of scope

- Auto-classifying which mesh is the top vs the base — still admin-tagged.
- Adding a dedicated `role` column on `product_fabric_swatches_public` — for now the "Top finishes" row reads the same wood swatches; a follow-up can split the pools once the admin has tagged them.
- Any tearsheet / quote label change beyond the top's swatch name flowing into the existing `selectedTopDisplay` field.
