## Mobile cleanup (PWA)

**1. Remove breadcrumbs on mobile product pages**
- `src/pages/PublicProductPage.tsx` (~line 1218): wrap the `<Breadcrumbs />` block in `hidden md:block` so the `HOME › STORAGE › SIDEBOARDS › …` trail no longer appears on mobile. Desktop is unchanged.

**2 & 3. Remove the floating sticky bottom nav (Gallery / Designers / Collectibles / WhatsApp)**
- This is `src/components/StickyBottomNav.tsx`, rendered only from `src/pages/Index.tsx` (line 593). It's the bar overlapping the "A Sociable Environment" gallery section and the Meet our Designers directory.
- Remove the `<StickyBottomNav />` render and its lazy import in `Index.tsx`. Leave the component file in place (unused) so nothing else breaks.

No desktop or trade changes. No logic changes elsewhere.