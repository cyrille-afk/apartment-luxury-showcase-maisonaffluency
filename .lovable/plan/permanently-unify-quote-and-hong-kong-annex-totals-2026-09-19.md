# Permanently unify quote and Hong Kong annex totals

## Goal
Make Page 3 a presentation-only view of the exact monetary values already computed for Page 1, preventing quote revisions or FX updates from creating divergent totals.

## Changes
- Create one immutable computed-totals snapshot during quote PDF generation.
- Pass that same snapshot to both the Page 1 totals renderer and the Page 3 Hong Kong annex.
- Remove Page 3's fallback to its independent landed-cost result whenever it is appended to a quote PDF.
- Map Page 3 fields directly from the shared snapshot:
  - Goods Value → Page 1 net subtotal
  - Premium Packing / additional charges → Page 1 charge rows
  - DAP delivered Hong Kong → Page 1 order total
- Keep HKD 308,435.61 as a regression-test expectation for the current Agni fixture, while preserving dynamic totals for future quotes.
- Apply the currency-code sanitizer to both billing and shipping address postal fields so `Kowloon Bay HKD` cannot print.

## Verification
- Generate the regression PDF and confirm Page 1 and Page 3 both show HKD 308,435.61.
- Confirm the deliberately corrupt standalone Page 3 value HK$1,745,261 and fallback FX rate 8.4746 never appear.
- Confirm `Kowloon Bay HKD` does not appear in extracted PDF text.
- Run the focused PDF tests and visually inspect the rendered affected pages.
