# Stabilize the mobile product CTA with a sticky viewport shell

## Outcome
- Keep the mobile price and quote panel inside the visible iOS Safari viewport while its browser controls expand or collapse.
- Remove the fixed, body-portaled positioning that currently slips into Safari's hidden browser area.

## Implementation
- Render the single mobile commerce panel inside the product page shell and change it to `position: sticky; bottom: 0` with an opaque surface and high stacking layer.
- Make the mobile product shell exactly `100dvh`, with `-webkit-fill-available` fallback and one internal vertical scroll region; keep horizontal overflow clipped.
- Continue measuring the panel height for nearby floating controls, without using scroll transforms or viewport offsets.
- Add a `pb-24` mobile buffer beneath the related-products section.
- Update the mobile regression test to verify sticky placement through scrolling and viewport-height changes.

## Verification
- Check the public product at an iPhone viewport at the top, middle, and bottom of its internal scroll region.
- Resize the visible viewport and confirm the panel remains at the shell's bottom edge.
- Confirm the quote action still opens and desktop layout remains unchanged.
