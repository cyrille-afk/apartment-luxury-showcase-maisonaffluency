# Single-Photo Gallery Slides

## Scope
- Restore every room’s four photographs as four separate slideshow pages.
- Remove the two-image diptych and all filled framing around portrait photographs.
- Center one image per page on a transparent canvas, using `object-contain` and a desktop 60vh maximum height so portrait images remain fully visible.
- Keep each photograph’s hotspot coordinates attached to its own image.
- Synchronize the footer controls, keyboard navigation, carousel selection, and progress line to `1 / 4` through `4 / 4`.

## Verification
- Confirm every slide renders exactly one image.
- Confirm portrait slides are centered, uncropped, and free of grey side panels.
- Confirm hotspots and all four navigation states work on desktop and mobile.
