# Repair the product image carousel

## Scope
- Replace the mobile product image strip with Embla in continuous loop mode so moving past the final image renders image one in the same direction without rewinding.
- Keep one logical image index for the inline carousel, fullscreen Editorial Gallery, finish-driven image changes, counter, and thumbnails. Scroll-based compact sizing will only change layout classes and control scale variables.
- Rebuild the Editorial Gallery as a body-level viewport portal with an opaque black surface and topmost controls, independent of the sticky product image, finish controls, footer, and purchase bar.
- Reset the carousel to image one when the page reaches the absolute top, synchronizing both the logical index and Embla position without leaving a partial slide.
- Apply the same behavior to public and Trade product pages through the shared gallery component, without changing pricing, finish selection, or checkout flows.

## Technical details
- Use the existing `embla-carousel-react` dependency with `loop: true`, one full-width slide per snap, and Embla `select`/`reInit` events as the source for user-driven index updates.
- Keep the carousel instance alive across compact/expanded frame changes and call `reInit` after the frame transition rather than deriving slide position from changing pixel widths.
- Convert externally requested image indices into Embla `scrollTo` calls; suppress feedback loops between Embla selection events and the parent-controlled index.
- Give the fullscreen portal `fixed inset-0 z-[10000] bg-foreground` semantics and keep its close control inside that root viewport layer.
- Add focused regression coverage for 8→1 forward looping, compact-state gallery opening/closing, and index reset at `scrollY === 0`.

## Verification
- Test the supplied Lantern Table Lamp flow at mobile Safari dimensions in expanded and compact states.
- Confirm 8/8 → 1/8 travels forward seamlessly in both inline and fullscreen views.
- Confirm returning to the page top produces a stable 1/8 frame with no blank or partial slide.
- Confirm the Editorial Gallery, finish caption, and close control remain fully visible above every page and purchase layer.