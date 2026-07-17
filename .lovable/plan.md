## Changes to `src/components/DesignersHoverHero.tsx`

**1. Use first curator pick image**
- Extend `DesignerGridCard`'s `designer` prop type to include `first_pick_image_url`.
- Update `pickGridImage` to prefer `first_pick_image_url` (Cloudinary-preferred), then fall back to `hero_image_url` / `image_url`.
- The data is already fetched (line 190) — just wire it into the card.

**2. Full-width, adaptive 2-column grid**
- Remove horizontal padding `px-4` on the two mobile grid wrappers (lines 1546, 1594) so the columns extend edge-to-edge.
- Keep `grid-cols-2` (naturally adaptive to viewport width via `w-full` cards).

**3. Padding between cards**
- Increase gap from `gap-3` → `gap-2` horizontal + `gap-3` vertical? Actually user wants padding *between* cards while using full width. Use `gap-2` (8px) between columns so cards still breathe without side margins, matching the reference screenshot.
- Final classes: `grid grid-cols-2 gap-2 pt-2 pb-4` (and `pt-1` variant for the accordion body).

No other files change. Desktop layout untouched.