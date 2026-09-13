# Restore the Root-Level Mobile Product Bar

## Scope
- Keep the mobile product CTA mounted in the application-level overlay host outside all route content and scrolling `<main>` elements.
- Replace the dock container styling with exactly: `fixed bottom-0 left-0 w-full z-50 bg-white border-t border-gray-100`, plus `pb-[env(safe-area-inset-bottom,16px)]` for iOS.
- Remove the visual-viewport offset variable, scroll-position calculations, transforms, manual bottom styles, height constraints, shadows, and nested background/padding wrappers added by the prior fixes.
- Keep the existing price, finish-selection, ordering, quote, and drawer behavior unchanged.
- Reposition the three-dot control from the measured dock height without reintroducing viewport offsets.

## Verification
- Check an iPhone-sized public product page at the top, mid-scroll, and page bottom.
- Confirm the entire bar remains visible at the browser bottom and is parented by the application-level overlay host.
- Confirm the finish CTA and order flow still respond correctly.
