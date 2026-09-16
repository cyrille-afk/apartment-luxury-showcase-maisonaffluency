# Optimize Curator Portrait and Showroom Layout

## Scope
- Rebalance the desktop portrait header into a compact, equal-height two-column composition.
- Move the studio thumbnail row beneath the header so it no longer creates dead space inside the biography column.
- Standardize Curators’ Picks image frames and show every product fully without cropping.
- Preserve the existing mobile presentation, product controls, captions, and lightbox behavior.

## Implementation
- Refactor the underlaid desktop portrait header in `NewInSpotlight` to use a constrained landscape hero frame and a naturally flowing biography stack.
- Render “From the Studio” as a separate compact row directly below the header, using uniform square thumbnails with contained imagery.
- Give desktop product cards a consistent 4:3 frame with a firm maximum height and canvas-colored background.
- Force both primary and alternate product images to use centered `object-contain`, removing designer-specific crop behavior.

## Verification
- Check the Jean-Michel Frank page at the supplied desktop viewport.
- Confirm the portrait header has no large white void, studio thumbnails are uniform, and table/chair/sofa silhouettes are fully visible.
- Confirm another designer page and a mobile viewport remain correctly composed.
- Run the relevant TypeScript check.
