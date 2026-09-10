# Armchair Product Configuration Upgrade

## Scope
- Reorder the armchair detail column so finish choices, motion choice, dimensions, and purchase actions form one continuous configuration stack.
- Keep this behavior limited to products whose catalogue variants explicitly contain both swivel and non-swivel versions.

## Implementation
1. Parse the existing variant labels into two motion choices: **Swivel Base** and **Fixed Static Base**.
2. Add an always-visible, accessible horizontal radio/chip group directly below the finish selectors.
3. Feed the selected motion into the existing variant resolver so its exact catalogue price updates across the page, cart, quote intake, and order payload.
4. Render the resolved product dimensions directly beneath the motion selector using small, tracked muted text.
5. Move the desktop **PLACE ORDER** and **REQUEST A BESPOKE QUOTE / CUSTOMISATION** action panel below that configuration and dimensions stack.
6. Preserve the existing finish selectors, image behavior, trade pricing, mobile purchase dock, and non-armchair templates.

## Technical Details
- Use the current `size_variants` data as the source of truth. Koumac already contains priced swivel and non-swivel rows, so no invented premium or database edit is needed.
- Normalize the label only for matching; retain the existing catalogue prices and configured finish combinations.
- Add focused tests for motion detection and exact variant-price resolution.
- Verify the Koumac page at desktop and mobile widths, including price changes, CTA placement, keyboard selection, and no horizontal overflow.
