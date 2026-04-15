
Goal

Make the description UX identical across Trade and Public:
- Grid cards: description appears inside the image box, never outside it
- Lightbox: description lives as an in-image dropdown/info control, not as hardcoded legend text
- Same data source (`product.description`) everywhere

What I found

- Trade grid cards currently use portal tooltips in:
  - `src/pages/TradeGallery.tsx`
  - `src/components/trade/ShowroomGridView.tsx`
- Public lightbox currently shows description in the right-hand text column in:
  - `src/components/PublicProductLightbox.tsx`
- Trade lightbox already has the correct direction conceptually: an image-overlay dropdown in:
  - `src/components/trade/TradeProductLightbox.tsx`
- Public card grids do not yet mirror the trade card description behavior:
  - `src/pages/PublicDesignerProfile.tsx`
  - `src/components/NewInSpotlight.tsx`
  - `src/pages/PublicFavorites.tsx`

Implementation plan

1. Revert the wrong tooltip direction on Trade grids
- Remove the Radix/portal description tooltip from `TradeGallery.tsx` and `ShowroomGridView.tsx`
- Put the description back inside the image box as an absolute in-card overlay
- Keep it clipped within the card bounds on purpose, since that is the requested behavior

2. Create one shared in-card description overlay
- Build a reusable description overlay component for product cards
- Use the same visual treatment on both Trade and Public product cards
- Show only when a real trimmed description exists
- Keep existing hover-image, favorite, pin, quote, and spec-sheet actions working

3. Apply the same in-box overlay to Public product cards
- Add the shared overlay to:
  - `PublicDesignerProfile.tsx`
  - `NewInSpotlight.tsx`
  - `PublicFavorites.tsx`
- This makes the Public side mirror the Trade gallery/showroom card behavior

4. Make the lightbox behavior identical on both sides
- Extract or duplicate the Trade lightbox’s image-based description dropdown pattern into a shared lightbox description component
- Use it in:
  - `src/components/trade/TradeProductLightbox.tsx`
  - `src/components/PublicProductLightbox.tsx`
- Remove the current hardcoded description paragraph from the Public lightbox legend/details column

5. Keep data flow unchanged, only fix presentation
- Continue using the existing `description` field already mapped into:
  - trade lightbox items
  - public lightbox items
- No database change needed
- No change to the description writer logic

Files to update

- `src/pages/TradeGallery.tsx`
- `src/components/trade/ShowroomGridView.tsx`
- `src/components/trade/TradeProductLightbox.tsx`
- `src/components/PublicProductLightbox.tsx`
- `src/pages/PublicDesignerProfile.tsx`
- `src/components/NewInSpotlight.tsx`
- `src/pages/PublicFavorites.tsx`
- plus 1 shared UI helper for the mirrored description UI

Technical details

- Card overlay should be rendered inside the image wrapper, not portaled
- Public lightbox should stop rendering description in the right-side legend/details block
- Both lightboxes should use the same dropdown trigger, placement, expansion behavior, and truncation rules
- Empty/whitespace-only descriptions should render nothing

QA checklist

- Trade Gallery: description appears inside the card image box
- Trade Showroom Product Grid: same behavior
- Public designer/product grids: same in-box behavior
- Public lightbox: description is no longer hardcoded in the legend
- Trade and Public lightboxes both show the same dropdown-on-image behavior
- Hover images, buttons, and lightbox open/close interactions still work normally
