

## Problems

1. **Header/content border**: There's a visible line separating the navigation from the page content. The background should be uniformly white with no demarcation.
2. **Padding**: The spacing between the header and the product content needs to equal the header height (~80px), currently `pt-32` (128px) is too much or the visual gap looks wrong due to the oversized image container.
3. **Image container too tall**: The `aspect-[3/4]` ratio combined with `object-contain` creates large empty bands above and below the product photo.

## Changes — `src/pages/PublicProductPage.tsx`

### A. Remove header border / ensure white background
The Navigation component likely adds a `border-b`. The page wrapper already uses `bg-background`. We need to check if Navigation has a border and if so, the product page should override or the container should feel seamless. The page `div` background is already `bg-background` — the issue is likely the nav's bottom border. We'll add a white background strip or adjust the page wrapper to overlap.

### B. Adjust top padding
Change `pt-32` to `pt-24` (96px ≈ header height). This gives breathing room equal to roughly the header height without excessive white space.

### C. Fix image aspect ratio
Change `aspect-[3/4]` to `aspect-square` on the main image container. This reduces the vertical excess. Combined with `object-contain`, the image will sit naturally without oversized padding bands above/below.

### Files
- `src/pages/PublicProductPage.tsx` — adjust `pt-32` → `pt-24`, change `aspect-[3/4]` → `aspect-square`, remove any visible border between nav and content
- Check `src/components/Navigation.tsx` for the border-bottom class to understand if we need a page-level override

