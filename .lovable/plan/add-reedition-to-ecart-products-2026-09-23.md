# Add “Reedition” to Ecart Products

## Change
- Treat products owned by Ecart or by designers whose parent house is Ecart as Ecart re-editions.
- Show the exact label **“Reedition”** on every active Ecart product card, including Ecart’s grouped designer grids and catalogue/category cards.
- Show the same label on both public and Trade product pages.
- Keep any existing edition number or edition description visible separately; do not replace it with “Reedition.”

## Technical details
- Add one shared Ecart/re-edition detection and label helper so card and product-page behavior stays consistent.
- Pass the existing designer/founder attribution into the helper in the active public and Trade renderers.
- Avoid database content changes: Ecart affiliation already exists through the designer parent relationship.

## Verification
- Check representative products from Jean-Michel Frank and another Ecart designer on public and Trade cards/pages.
- Confirm non-Ecart products do not receive the label.
- Confirm existing limited-edition or numbered-edition text remains unchanged.
