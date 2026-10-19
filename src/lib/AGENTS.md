# src/lib rules

- Curator-pick slugs: the set_curator_pick_slug trigger replaces truncated/ambiguous slugs (1–2 chars, cut-off untitled-piec…) with title slugs; curator_pick_slug_audit lists remaining truncated/duplicate slugs — truncated slugs made product pages resolve to other designers' items. Map retired slugs in legacyProductSlugs.ts so old URLs redirect.

- Room shortlist covers pass optional plain-text client/project/introduction fields to the shared PDF generator; device-local metadata is scoped by account, room and saved shortlist ID, separate from public share snapshots — keeps personal cover copy out of shared catalogue data and prevents cross-shortlist reuse.
