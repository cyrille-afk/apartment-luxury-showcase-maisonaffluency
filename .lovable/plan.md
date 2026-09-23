# Fix collection product cards

## Changes
- Update the active room/category product card to render the product image, Apparatus/designer label, product name, and a stable right-aligned price slot.
- Read safe public RRP metadata in batch; display the formatted amount when numeric, otherwise show exactly “Price upon Request”.
- Remove the collection card’s gallery/lightbox click path and its obsolete modal state/rendering.
- Route every card directly to `/products/<product-slug>` on desktop and mobile, while preserving separate designer and comparison controls.
- Add `/products/:productSlug` as a real public product-detail route and resolve the product globally by canonical slug without reopening a portfolio overlay.

## Verification
- Check Signal Y in the Living Room collection for complete metadata and direct navigation.
- Confirm the destination renders the standalone product page and does not open an overlay.
- Check one priced and one unpriced card, then run the relevant type and browser checks.
