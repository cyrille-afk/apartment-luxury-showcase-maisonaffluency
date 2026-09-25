# Dropdown Ambient Image Matte Frames

## Build
- Replace the edge-to-edge ambient image layer in both shared dropdown implementations with a full-column ivory canvas using the existing collection-card color token.
- Add even internal spacing around each photograph so Living, Dining, Bedroom, and Lighting use the same museum-style matte frame.
- Keep each photograph centered and fully visible within the available frame without cropping its focal content.
- Preserve the current 300ms crossfade: the framed image is visible when a menu opens, fades only while a left category is active, and returns when category hover ends.

## Verification
- Open all four desktop dropdowns and confirm consistent inset spacing on every edge.
- Confirm each default image is uncropped and each category hover fades to the corresponding submenu without layout movement.
