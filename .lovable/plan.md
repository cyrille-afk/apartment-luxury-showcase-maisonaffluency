

## Fix curator pick card display issues across public grids

### Problem
The public homepage product grid (`PickCard` in `DesignersDirectory.tsx`) and `NewInSpotlight.tsx` show several display issues, plus there are duplicate database picks under "Gabriel Hendifar" that should only live under the parent "Apparatus Studio".

### Changes

**1. Database cleanup — remove Gabriel Hendifar duplicate picks**

The `Apparatus Studio` parent designer already owns all 9 curator picks. The child `Gabriel Hendifar` designer has 3 duplicates that need deletion:
- `Median 3` (id `bd785c79-e673-4c0c-8b7d-edb7b103e2d5`)
- `Lariat` (id `bc4e9792-ad98-4c5c-8dc8-12a388219c47`)
- `Portal` (id `7527dcfe-c685-45d8-b1b4-eb5306a66c0a`)

Delete via migration. Per the brand-hierarchy rule, the parent (Apparatus Studio) keeps all picks regardless.

**2. Database cleanup — Forest & Giaconia designer name**

The `designers.name` is currently `Forest & Giaconia - for Delcourt Collection`, which renders the ugly suffix everywhere. The actual collection these pieces belong to is `Archimobilier` (already in subtitle). Update designer name to just `Forest & Giaconia` so the brand line reads cleanly.

**3. Database cleanup — Angelo W subtitle → edition badge**

Pick `08d6ee54-7caf-40c7-a68e-764f2a154172` (Angelo W) has:
- `subtitle = "Limited Edition of 7"` (wrong — duplicates edition info into legend)
- `edition = "Limited edition of 7 pieces"` (correct — drives the badge)

Clear the subtitle so the legend stops showing "Limited Edition of 7" as a sub-line; the badge already exists.

**4. `src/components/DesignersDirectory.tsx` — `PickCard` legend logic (lines 918–943)**

Update the inline IIFE that builds the brand/title/subtitle block:

- **Strip `" - ..."` suffix from `brandLine`** so any designer name like `"X - for Y"` renders only `"X"`.
- **Detect generic-category subtitles** (e.g. `Dining Table`, `Pendant`, `Coffee Table`, `Side Table`, `Surface Light`, `Console Table`, `Reading Floor Lamp`, `Cocktail Table`, `Table Lamp`) and **append them to the title on the same line** instead of rendering them as a separate sub-line. Heuristic: subtitle matches a known furniture type token AND title doesn't already include it.
- **Suppress edition-like subtitles** (regex: `/^(limited\s+)?edition\b/i`) — these belong in the badge only.
- Keep existing handling for year (`(2024)` suffix), `re-edition` badge, and `for X` brand-line override.

**5. `src/components/NewInSpotlight.tsx` — pick legend block (lines 364–378)**

Apply the same rules to keep the homepage spotlight grid consistent:

- Hide `pick.subtitle` when it matches the edition regex or when it's a generic category that's already merged into the title.
- **Remove the `pick.materials` line entirely** (lines 366–370). Materials belong to the lightbox detail view, not the public grid card. Keep `pick.dimensions` removed too for symmetry with `PublicDesignerProfile` and `TradeAtelierProfile` (which already hide them on the grid).
- Merge generic-category subtitle into title using the same helper.

**6. Extract a tiny shared helper**

Create `src/lib/curatorPickLegend.ts` exporting two functions used by both grids:
- `cleanBrandLine(designerName: string): string` — strips `" - ..."` suffix.
- `composeTitle(title: string, subtitle?: string): { title: string; remainingSubtitle?: string }` — merges generic category subtitles into the title; returns `remainingSubtitle = undefined` when merged or when subtitle is edition-like.

This keeps a single source of truth for the rules so future grids (presentation builder, tearsheets) can reuse it.

### Verification

After changes, confirm on `/` (homepage) and any `/products-category/*` route:
- Forest & Giaconia card → brand reads `FOREST & GIACONIA`, no `for Archimobilier` duplicated subtitle if title already mentions Archimobilier; otherwise `for Archimobilier` stays.
- Apparatus Studio Portal card → reads `Portal Dining Table` on one line, no separate `Dining Table` sub-line. No duplicate Gabriel Hendifar Portal card anywhere.
- Atelier Pendhapa Astra card → no materials line under the title.
- Alinea Angelo W card → shows `Limited Edition of 7` only as the badge (top-left of image), not in the legend.
- De La Espada Orion card → unchanged, `by Anthony Guerrée` stays as the subtitle line (correctly spelled — the database is already correct).

### Technical notes
- No schema migration. Three data operations: delete 3 picks, update 1 designer name, clear 1 subtitle.
- No changes to lightbox/detail components — they continue to show full materials/dimensions/edition info.
- The `TradeAtelierProfile` and `PublicDesignerProfile` grids already hide subtitle/materials/dimensions; this brings the homepage and category grids to parity.

