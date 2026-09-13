# Permanently Isolate the Mobile Product CTA

## Scope
- Remove every mobile dock instance from the nested product configuration and workspace branches.
- Render one authoritative mobile CTA at the outermost product-page level, after the page content and outside `<main>`, with its existing dialog/drawer behavior preserved.
- Keep the dock portaled directly to `document.body` so product wrappers, footer layers, transforms, containment, and overflow cannot establish its containing block.
- Apply the requested fixed full-width surface and maximum stacking order: `fixed bottom-0 left-0 w-full z-[9999] bg-white border-t border-gray-100 block`, plus `bottom-[env(safe-area-inset-bottom,0px)]`.
- Add a page-scoped root marker and neutralize positioning, transforms, containment, isolation, overflow clipping, and filters on `html`, `body`, `#root`, and the product-page wrapper on mobile only.
- Preserve desktop commerce panels, pricing/finish logic, checkout actions, quote flow, and safe-area-aware floating-button spacing.

## Verification
- Test an unpriced public product at an iPhone viewport before and after a full-page scroll.
- Confirm the CTA remains attached to the viewport, above footer/content, with computed `position: fixed`, the safe-area bottom value, and `z-index: 9999`.
- Confirm only one mobile CTA exists and its quote action still opens correctly.
