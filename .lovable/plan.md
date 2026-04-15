
What I found

- The description data is already flowing into both trade surfaces:
  - `src/pages/TradeGallery.tsx` gets `description` from `useTradeProducts()`
  - `src/components/trade/ShowroomGridView.tsx` enriches hotspot products with `description`
  - `src/components/trade/TradeProductLightbox.tsx` already shows the same description in the lightbox
- Both grid components already contain the attempted tooltip JSX, so this is no longer a missing-data issue.
- The current tooltip is still a CSS-only `absolute` box controlled by `group-hover`. Even after moving it outside the image wrapper, it remains fragile inside a dense card grid and can still fail visually because of stacking/hover interactions.

Plan

1. Replace the current CSS-only hover box with a real portal-based tooltip
- Use the existing shared tooltip primitives in `src/components/ui/tooltip.tsx`
- Render description content through the tooltip portal so it is no longer clipped or buried inside card/grid stacking contexts

2. Apply the same tooltip pattern in both trade card grids
- `src/pages/TradeGallery.tsx`
- `src/components/trade/ShowroomGridView.tsx`
- Remove the current inline `absolute ... group-hover:opacity-100` description block in both files
- Keep favorite, pin, add-to-quote, and lightbox click behavior unchanged

3. Keep description sourcing aligned with the current lightbox text
- `TradeGallery`: use the same `product.description` already passed to the lightbox
- `ShowroomGridView`: keep the current enrichment logic, but normalize empty/whitespace descriptions so the tooltip appears whenever a real description exists

4. Verify the actual surfaces the user is referring to
- `/trade/gallery`
- `/trade/showroom` → Product Grid tab
- Confirm the tooltip appears on hover for cards with descriptions, including items with hover images

Technical details

- Best implementation: make the image/card area the tooltip trigger and show a compact multi-line tooltip (`max width`, `line clamp`, high z-index)
- Reason for this approach: the existing code already tried the overflow/z-index fix; a portal tooltip is the robust fix that avoids repeating the same failure mode
- Files to update:
  - `src/pages/TradeGallery.tsx`
  - `src/components/trade/ShowroomGridView.tsx`
  - possibly a small shared trade tooltip helper component if needed for reuse

QA checklist

- Hover works in both Trade Gallery and Showroom Product Grid
- Tooltip is visible above hover image and action buttons
- Tooltip text matches the lightbox description
- Cards without descriptions show no empty tooltip
- Lightbox opening and quote actions still work normally
