# CC-Tapis designer cleanup

## What changes

**1. Biographies — fill the 52 empty profiles**

For every `*-cc-tapis` designer with an empty `biography`, generate a 3–5 paragraph editorial bio covering:
- Studio origin, training, geography
- Design language and material vocabulary
- The specific CC-Tapis collaboration (collections, techniques — Tibetan/Himalayan hand-knot, Nepalese ateliers, materials like NZ wool, Chinese silk, hemp, allo)
- Recognition / context within contemporary collectible rug design
- Closing line on what the partnership represents

Rules:
- English, no source URLs, no markdown citation links (per the new sanitizer)
- Standalone media URLs allowed, but I won't add any — text only
- ~1500–2200 characters each, matching the tone of existing CC-Tapis bios (Alex Proba, De Troupe, Damien Ajavon)
- Don't touch the 12 designers who already have bios

Run as bulk DB update via `update_memory`-safe data migration (UPDATE statements on `designers`).

**2. Portraits — verify, don't replace**

Only `cristian-mohaded-cc-tapis` is missing `image_url`. I'll flag it for you to upload manually (per your answer to question 2). All other 63 portraits already exist — no action.

**3. Hero images — leave alone**

Per your answer, the 62 missing hero fields stay empty. You'll upload in-situ shots through the admin. The profile page already falls back gracefully when `hero_image_url` is null.

**4. Share icons — remove from all designer cards**

In `src/components/DesignersDirectory.tsx`, remove three Share buttons:
- Line ~496: grid-view card share
- Line ~564: parent-brand sub-card share
- Line ~584: alternate variant share

Keep the section-level Share buttons (lines ~1602, ~1620) — those are the hero-area shares on the directory page itself.

The designer profile hero Share button lives in a different file (`DesignerProfile.tsx` / its hero subcomponent) and is untouched.

Also delete now-dead helpers (`handleDesignerShare`, the inner `handleShare`, `buildShareUrl`) if no longer referenced after the removals, plus the `Share2` import if unused.

## Out of scope
- No image generation, no Firecrawl scraping
- No edits to existing 12 bios
- No schema changes
- No changes to share buttons outside DesignersDirectory cards

## Technical notes
- Bios written via a single `supabase--insert` UPDATE … WHERE slug IN (…) AND (biography IS NULL OR biography = '').
- The `content_audit_log` trigger on `designers` will capture every change automatically — rollback is possible per row.
- After removing share buttons, run `bun run` build implicitly (harness does it) to catch unused-import errors.
