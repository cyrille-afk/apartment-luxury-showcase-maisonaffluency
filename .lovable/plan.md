

## Problem

The product page (`PublicProductPage.tsx`) currently renders the description as static text below materials/dimensions. The user wants it to match the lightbox behavior shown in screenshots 2 and 3:

1. **Hover overlay** — description appears as a floating card over the product image on hover (like Curators' Picks cards)
2. **Collapsible dropdown** — at the top of the product image, a compact bar shows a truncated description with a chevron to expand/collapse the full text

## Changes — `src/pages/PublicProductPage.tsx`

### A. Remove static description block
Delete lines 270-275 (the `{product.description && ...}` paragraph below materials/dimensions).

### B. Add hover overlay on the main image
Wrap the main image container in a `group` div. When hovered, show the description as a semi-transparent overlay at the bottom of the image — matching the card hover pattern.

### C. Add collapsible description bar above the image
Above the main image, render a compact row with an Info icon, truncated description text, and a chevron toggle. Clicking it expands to show the full description. Uses local state (`descOpen`). Styled with `bg-background/90 backdrop-blur` to match the lightbox pattern from screenshot 3.

### D. Layout
- The dropdown sits inside the image column, pinned to the top of the image area
- The hover overlay sits at the bottom of the image, fading in on hover
- Both only render when `product.description` exists

No other files need changes.

