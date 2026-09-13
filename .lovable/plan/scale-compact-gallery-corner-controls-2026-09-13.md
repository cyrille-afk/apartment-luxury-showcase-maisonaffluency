# Scale compact gallery corner controls

## Scope
- Derive a gallery-control scale from the live image-frame height, clamped to preserve touch usability.
- Scale each corner button, background pad, and vector icon as one centered unit while the frame collapses.
- Keep wrappers absolutely anchored to the image frame’s outer corners so scaling never pulls controls inward.
- Preserve share, favorite/save, presentation, menu, and gallery behavior.

## Technical details
- Publish the frame-relative scale as a CSS custom property on the image-frame element.
- Use a stable outer anchor and an inner transform origin matched to each corner.
- Apply the same scale to the gallery counter so all frame furniture remains proportionate.

## Verification
- Check expanded and compact states at an iPhone-sized viewport.
- Confirm controls shrink proportionally, remain centered, do not overlap the artwork, and stay attached to all three corners.
