# Trade Gallery toolbar: search/currency up, subcategory beside category

## Changes (Trade Gallery page only)
1. **Search + currency on the cart row** — move the search field and currency dropdown out of the filter toolbar into the row that holds the cart icon: search + currency on the left, cart stays on the right, same heights as today.
2. **Subcategory next to category** — move the subcategory dropdown out of the second row and place it immediately after the category dropdown in the main filter row (Studio / Creator, Category, Subcategory, Collections). It appears only when the chosen category has subcategories, as now.
3. Second row keeps Sort and Saved views only. Item count and view toggles stay on the right of the filter row.
4. Phone: rows stack as today, no sideways scroll.

## Verify
Signed-in screenshots at 1946px and 390px with Tables → Dining Tables selected; check filters, search, currency and cart still work.

## Technical
- `src/pages/TradeGallery.tsx`: move `gallery-search-currency` block into the cart row (`justify-between`); primary filters grid becomes `sm:grid-cols-4` when subcategories exist, else 3; remove subcategory from `gallery-secondary-tools`.
- Update mem://preferences/trade-gallery-toolbar to the new layout.
