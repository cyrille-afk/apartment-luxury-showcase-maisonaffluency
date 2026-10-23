# src/lib rules

- Curator-pick slugs: the set_curator_pick_slug trigger replaces truncated/ambiguous slugs (1–2 chars, cut-off untitled-piec…) with title slugs; curator_pick_slug_audit lists remaining truncated/duplicate slugs — truncated slugs made product pages resolve to other designers' items. Map retired slugs in legacyProductSlugs.ts so old URLs redirect.

- Room shortlist covers pass allowlisted plain-text cover, closing-message and contact fields to the shared PDF generator; closing-page text wraps and continues across unnumbered pages, with only valid email and HTTP(S) links; device-local metadata stays scoped by account, room and saved shortlist ID, separate from public share snapshots — prevents unsafe links, clipping and cross-shortlist reuse.
- Quote & Proforma list filtering (status, inclusive From/To dates, quick ranges) lives in src/lib/quoteFilters.ts as pure functions with unit tests in quoteFilters.test.ts — the page only renders them, so the rules stay testable and can't drift between views. Dates compare the studio's local calendar day, matching what the quote card prints.
