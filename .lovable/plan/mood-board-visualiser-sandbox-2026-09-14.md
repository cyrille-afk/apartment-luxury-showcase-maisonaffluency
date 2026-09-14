# Mood-Board Visualiser Sandbox

## Build
- Replace the current Visualiser banner, upload block, finish library, and card-based workspace with one fixed-height alabaster artboard.
- Add a centered floating executive toolbar for object sourcing, backdrop upload, layer order, and reset.
- Load a searchable horizontal product index from the live trade catalogue; clicking a product places a movable, resizable silhouette on the artboard.
- Add an unobtrusive layer-order tray so selected objects can move forward or backward without leaving the canvas.
- Preserve room-photo uploads, session persistence, and existing Axonometric Studio deep links as canvas backdrops.

## Interaction
- Keep the page itself non-scrolling on desktop; only the sourcing tray scrolls horizontally.
- Selecting an object exposes quiet drag/resize/remove controls and its title.
- Reset clears the backdrop and all placed objects after confirmation.
- Use the existing editorial typography and semantic palette; the uploaded screenshot remains a visual reference only.

## Verification
- Verify desktop fixed-height behavior at the current 1588×1182 viewport.
- Verify backdrop upload, product insertion, dragging, layer controls, reset, and no console errors.
- Check the compact mobile fallback remains usable.
