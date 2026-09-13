# Fix the Published iOS Sticky Commerce Bar

## Scope
- Remove the forced `overflow-y: scroll` root scroller and GPU transform from the mobile commerce bar; both create incorrect fixed-position compositing on real iOS Safari.
- Track Safari's actual visible viewport and expose its covered bottom inset as a CSS variable.
- Anchor the complete bar above that inset, preserving its full intrinsic height, safe-area padding, root-level portal, and current purchase behavior.
- Position the three-dot control from the measured full bar height so it cannot overlap or hide the bar.

## Verification
- Check the published product layout in mobile WebKit at the top, mid-page, and page bottom.
- Simulate changing visible viewport geometry and confirm the full bar moves above the browser panel without clipping.
- Confirm desktop remains unchanged and the primary action still works.
