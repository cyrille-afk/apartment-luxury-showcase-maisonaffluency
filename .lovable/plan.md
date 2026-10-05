# Alexander Lamont Trade Gallery Toolbar

## Scope
- Restore explicit 3-column and 4-column density controls on the trade gallery.
- Place the column controls and currency selector in one full-width, flex-spaced toolbar.
- Keep currency choices right-aligned and allow them to wrap or tighten without clipping the column controls.
- Preserve the existing search, designer/category filters, list view, cart, and saved density preference.

## Technical details
- Reuse the shared grid density control and map the saved gallery preference to 3 or 4 columns.
- Update the product grid classes so the selected desktop density genuinely renders three or four columns.
- Validate desktop and constrained-width layouts in the live preview, check the build signal, then publish the update.
