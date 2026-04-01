

## "New In" Feature — Pierre Bonnefille Spotlight

### Overview
Create a dedicated "New In" page featuring Pierre Bonnefille as the inaugural spotlight, accessible from a new navigation item in the header. The page showcases a hero image, a concise biography excerpt, a CTA linking to the full profile, and all Curators' Picks.

### What gets built

**1. New "New In" navigation item**
- **Desktop**: Add "New In" link in the bottom nav bar, positioned before "Journal" (right side, after the separator). Styled consistently with existing nav items.
- **Mobile**: Add "New In" entry in the slide-out menu, placed after "Collectible Design" and before "Journal".

**2. New page: `/new-in`**
- Route: `/new-in` → `src/pages/NewIn.tsx`
- Includes `<Navigation />` and `<Footer />` for consistency with other public pages.

**3. Page layout (top to bottom)**

- **Hero section**: Full-width image (Pierre Bonnefille workspace/collection shot from existing Cloudinary assets), with a dark gradient overlay. Designer name and "New In" label overlaid.

- **Biography excerpt**: The concise text you provided:
  > "Pierre Bonnefille is a French artist, painter, designer and 'Maître d'Art' — a title awarded by the French Ministry of Culture to masters of exceptional craft. A graduate of both the École Boulle and the École Nationale Supérieure des Arts Décoratifs in Paris, he has spent more than three decades creating his own materials, mixing pigments with sand and ground rock, sometimes applying gold or silver leaf on top, other times stamping the surface with fabric to leave behind what he calls a 'textile fossil', his signature textures."

- **CTA button**: "View The Full Portrait" — pill-styled button (matching existing pill conventions like the Curators' Picks badge). Links to `/designers/pierre-bonnefille` (the full public biography page).

- **Curators' Picks section**: Fetches all Pierre Bonnefille's curator picks from the database (using the existing `useDesignerPicks` hook). Displayed in a 4-column grid on desktop, 2-column on mobile — matching the established grid convention. Section header styled with the pill badge format. Separated with border-top and padding as per existing section styling patterns.

### Technical details

| Item | Detail |
|------|--------|
| New file | `src/pages/NewIn.tsx` |
| Modified files | `src/components/Navigation.tsx` (add nav item), `src/App.tsx` (add route) |
| Data source | `useDesigner` + `useDesignerPicks` hooks (existing, query from database) |
| Designer slug | `pierre-bonnefille` |
| Styling | Tailwind, framer-motion animations consistent with designer profile pages |
| SEO | Helmet meta tags for "New In — Pierre Bonnefille — Maison Affluency" |

### Navigation placement

```text
Desktop bottom bar:
Gallery | All Categories | Designers | Collectible Design  ·  New In | Journal | Trade Program

Mobile menu (top to bottom):
Gallery
  All Categories
Designers & Makers
Collectible Design
New In          ← inserted here
Journal
```

