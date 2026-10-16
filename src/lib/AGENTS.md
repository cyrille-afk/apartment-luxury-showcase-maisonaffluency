# src/lib rules

- Curator-pick slugs: the set_curator_pick_slug trigger replaces truncated/ambiguous slugs (1–2 chars, cut-off untitled-piec…) with title slugs; curator_pick_slug_audit lists remaining truncated/duplicate slugs — truncated slugs made product pages resolve to other designers' items. Map retired slugs in legacyProductSlugs.ts so old URLs redirect.
