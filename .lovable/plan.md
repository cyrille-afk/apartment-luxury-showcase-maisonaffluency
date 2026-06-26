## Goal

Replace the toggle-only `/trade/collectibles/admin` with a real per-atelier editor for:
- Name, founder, specialty, hero image
- Gallery images (reorderable list)
- External links (website, Instagram)

Other content (biography, curator picks, philosophy, etc.) stays sourced from the existing hardcoded array — it is not in scope for this turn.

## What I'll build

### 1. Database
Two new tables (with GRANTs + RLS):

- `collectible_atelier_overrides` (one row per slug)
  - `slug` PK, `name`, `founder`, `specialty`, `hero_image_url`, `website_url`, `instagram_url`, `updated_by`, timestamps
  - Public `SELECT`, admin-only write
- `collectible_atelier_gallery` (ordered images per slug)
  - `id`, `slug`, `image_url`, `caption`, `position`, timestamps
  - Public `SELECT`, admin-only write

Seed migration: insert one override row per existing atelier with the values currently hardcoded, so the live site doesn't change until an admin edits something.

### 2. Read path
- New hook `useCollectibleAteliers()` fetching both tables in one go (cached, like `useCollectibleOverrides`).
- `Collectibles.tsx`, `CollectiblesHoverHero.tsx`, `PublicCollectibles.tsx`, and any atelier detail view: merge DB values over the hardcoded base — DB wins for the editable fields, hardcoded still wins for biography / curator picks / philosophy.
- `trade_only` flag stays where it is (existing `collectible_overrides` table).

### 3. Admin UI (`/trade/collectibles/admin`)
- Keep the searchable list, add an **Edit** button per row that opens a side sheet (shadcn `Sheet`) with:
  - Text inputs: name, founder, specialty, website URL, Instagram URL
  - Hero image: URL input + live preview (Cloudinary URL accepted)
  - Gallery: list with add / remove / drag-to-reorder, URL input + preview per item
  - Save / Reset-to-default / Cancel
- Trade-Only switch stays inline on the row (unchanged).

### 4. Validation
Zod schema for name (1–120), specialty (≤200), founder (≤120), URLs (`z.string().url()` or empty), gallery items (≤30, each URL valid).

## Out of scope (call out to user)
- Editing biography, notable works, philosophy, curator picks — these stay hardcoded for now. If you want those editable too, that's a follow-up turn (curator picks especially are a much bigger table).
- No image upload widget — admins paste Cloudinary/Supabase URLs (same convention as the rest of the trade admin).

## Files touched
- New migration (tables, grants, RLS, seed)
- New `src/hooks/useCollectibleAteliers.ts`
- Rewrite `src/pages/TradeCollectiblesAdmin.tsx` (list + edit sheet)
- `src/components/Collectibles.tsx`, `src/components/CollectiblesHoverHero.tsx`, `src/pages/PublicCollectibles.tsx`: merge DB overrides into the rendered data

Confirm and I'll start with the migration.