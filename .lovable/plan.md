
Root cause: the earlier implementation was applied to `ShowroomGridView` inside `/trade/showroom`, not to the actual `/trade/gallery` page you are using now. The code confirms `/trade/gallery` still has its own legacy lightbox flow:
- `src/pages/TradeGallery.tsx` still keeps `lightboxProduct` state
- product cards still call `setLightboxProduct(...)`
- the page still renders `<TradeProductLightbox />`
So the preview is behaving correctly for the current code: the wrong surface was updated.

Plan

1. Align `/trade/gallery` with the new B2B product-sheet pattern
- Replace all `setLightboxProduct(...)` product-opening actions in `TradeGallery.tsx` with navigation to `/trade/products/:slug/:productSlug`
- Reuse the same route already added in `App.tsx`
- Preserve origin with `state: { from: location.pathname + location.search }` so back returns to the exact filtered gallery

2. Add reliable designer-slug resolution in `TradeGallery`
- Build the same `designer name/display_name -> slug` lookup used in the showroom grid approach
- Fall back to slugified brand name if no exact mapping exists
- Use the existing product title slug logic so URLs resolve consistently with `TradeProductPage`

3. Remove the legacy lightbox behavior from `/trade/gallery`
- Delete `lightboxProduct` state and `TradeProductLightbox` rendering from `TradeGallery.tsx`
- Remove the `toLightboxItem` conversion helper and lightbox-specific add-to-quote handler
- Update:
  - grid card click
  - suggestion-strip click
  - any list-row product-open interaction
  so they all navigate to the trade product page instead

4. Decide hotspot behavior inside the immersive gallery views
- Keep hotspot “Add to Quote” as a quick action
- Add/restore a “View Product” path from trade-context hotspots so users can open the full trade product sheet from the gallery imagery too
- If a hotspot only has quote/add behavior today, extend the trade gallery flow so discovery can lead into the sheet rather than stopping at the lightbox paradigm

5. QA the exact routes involved
- Verify `/trade/gallery` opens the full product sheet from cards, suggestions, and any list view interactions
- Verify back navigation returns to the same filtered/search state
- Verify `/trade/showroom?tab=grid` still works the same way
- Verify no remaining `TradeProductLightbox` opens from the trade catalog flows unless intentionally kept somewhere else

Technical details
- Files to update:
  - `src/pages/TradeGallery.tsx`
  - possibly `src/components/Gallery.tsx` if trade hotspot “view product” should open the trade sheet
- Files already correct:
  - `src/pages/TradeProductPage.tsx`
  - `src/App.tsx`
  - `src/components/trade/ShowroomGridView.tsx`
- Important distinction:
```text
/trade/showroom     -> partially migrated already
/trade/gallery      -> still legacy lightbox
```

Expected result
- Trade catalog browsing becomes consistent:
```text
Trade Gallery card click
    -> /trade/products/:slug/:productSlug
    -> Back returns to Trade Gallery with filters/search preserved
```
