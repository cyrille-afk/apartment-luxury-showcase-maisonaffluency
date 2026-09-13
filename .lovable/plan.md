# Fix iOS Safari Product Controls

## Scope
- Anchor the mobile checkout bar above the iOS safe area using `env(safe-area-inset-bottom, 0px)`.
- Keep the product page on dynamic viewport sizing with `100dvh` in loading, missing-product, and main states.
- Render the checkout bar as a full-width fixed white surface at `z-[100]` so page and footer layers cannot mask it.
- Position the mobile three-dot action button at `calc(env(safe-area-inset-bottom, 0px) + 70px)` with `z-[100]` while the product checkout bar is present.

## Verification
- Check the product page at an iPhone-sized viewport before and after scrolling.
- Confirm the checkout bar remains visible above the Safari safe area and the three-dot control stays directly above it.
