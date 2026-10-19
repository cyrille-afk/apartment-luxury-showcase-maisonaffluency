# src/lib rules

- Curator-pick slugs: the set_curator_pick_slug trigger replaces truncated/ambiguous slugs (1–2 chars, cut-off untitled-piec…) with title slugs; curator_pick_slug_audit lists remaining truncated/duplicate slugs — truncated slugs made product pages resolve to other designers' items. Map retired slugs in legacyProductSlugs.ts so old URLs redirect.

- Room shortlist covers pass allowlisted plain-text cover, closing-message and contact fields to the shared PDF generator; closing-page text wraps and continues across unnumbered pages, with only valid email and HTTP(S) links; device-local metadata stays scoped by account, room and saved shortlist ID, separate from public share snapshots — prevents unsafe links, clipping and cross-shortlist reuse.
