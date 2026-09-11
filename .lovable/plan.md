# Fix Amélie product image cropping

## Implementation
- Use the active route slug to identify Amélie’s catalog reliably.
- Render Amélie’s desktop product photos directly with `object-contain` in portrait frames, bypassing the hover-image wrapper that is still applying `object-cover`.
- Keep all other designers and the mobile masonry layout unchanged.

## Verification
- Inspect computed image fit and frame ratio on the local Amélie page.
- Compare desktop screenshots and confirm every product is fully visible.
- Run the relevant TypeScript checks.
