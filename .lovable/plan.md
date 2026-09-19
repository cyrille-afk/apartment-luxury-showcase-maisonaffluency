# Permanently stabilize the iOS mobile product CTA

## Outcome
- Keep the mobile “Request Quote & Customization” bar fully visible above Safari’s home indicator and browser controls.
- Prevent the bar from moving with page overscroll or being clipped by product content.
- Apply the fix through the shared product commerce component so every public mobile product page inherits it.

## Implementation
1. Keep the product page root on dynamic viewport sizing with `min-height: 100dvh`, including loading and missing-product states used by the same page.
2. Harden the single root-level mobile commerce bar as a body portal with `position: fixed`, `left: 0`, `right: 0`, `bottom: 0`, and a high stacking layer.
3. Give the bar explicit safe-area bottom padding using `env(safe-area-inset-bottom, 16px)` while preserving its existing price and action layout.
4. Remove transform or scroll-dependent positioning from the mobile bar itself; retain height measurement only for nearby floating controls.
5. Add a mobile product-page CSS guard so the route uses stable dynamic viewport sizing without introducing a competing root scroll container.

## Verification
- Test the Aragon Coffee Table product at iPhone dimensions at the top, middle, and bottom of the page.
- Simulate Safari viewport-height changes and confirm the CTA stays fixed, fully visible, and does not bounce.
- Confirm the quote action still opens the existing three-step flow and desktop product layouts remain unchanged.
