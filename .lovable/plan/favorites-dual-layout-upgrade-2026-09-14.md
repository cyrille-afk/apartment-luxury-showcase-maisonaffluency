# Favorites Dual-Layout Upgrade

## Goal
Turn **Saved Products** into a two-mode editorial archive with a visual masonry spread and a compact procurement ledger, while preserving search, folders, currency conversion, quote actions, 3D selection, removal, and product detail opening.

## What will change

### Operational ribbon
- Replace the current boxed icon switch with two borderless micro-links beside the currency selectors:
  - `[ ▦ EDITORIAL GRID ]`
  - `[ ☰ TECHNICAL LIST ]`
- Keep `grid` as the default local view state.
- Mark the active mode with a thin underline and stronger text; keep the inactive mode muted.
- Preserve the existing flat currency row and responsive wrapping.

### Editorial Grid
- Replace identical framed cards with an unframed, asymmetrical masonry spread.
- Use large, high-quality imagery with varied editorial proportions and generous whitespace.
- Show only the product title and designer/maker beneath each image in restrained serif typography.
- Preserve product opening, remove, and 3D-selection actions without reintroducing card borders, rounded containers, or shadows.

### Technical List
- Replace cards with a flat full-width ledger.
- Add aligned columns for:
  - 40px thumbnail
  - SKU / Item ID
  - Product name
  - Designer / Maker
  - Dimensions (W × D × H)
  - Lead time
  - Price
- Separate rows only with faint one-pixel horizontal dividers.
- Keep rows clickable for product details and retain discreet remove controls.
- Extend the Favorites product query to include SKU and structured dimension fields where available, with the existing dimension string as fallback.

### Client View privacy
- Read the existing global Trade/Client View state.
- In Client View, display only converted MSRP and never render trade prices, discount values, margins, or wholesale terminology.
- In Studio View, keep the current trade price display behavior.
- Apply the same privacy rule to any price passed into the product detail lightbox from Favorites.

### Empty and loading states
- Keep both modes hidden when there are no matching saved products.
- Center the existing editorial empty-state message on the alabaster workspace.
- Replace rounded loading cards with flat placeholders matching the selected layout.

## Validation
- Verify authenticated Favorites at 1588×1182 and a mobile viewport.
- Confirm both toggles switch instantly and maintain correct active styling.
- Confirm list columns align and grid captions do not truncate.
- Verify Studio View shows trade pricing and Client View shows MSRP only, including after opening a product.
- Verify empty search/folder results show only the centered empty state.
- Run the TypeScript check and inspect browser console errors.
