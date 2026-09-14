# Project Studio Client Privacy Refinement

## Goal
Make the Project Studio ledger switch and header Client View control operate as one privacy mode, with client-safe pricing and spacing.

## Changes
- Keep both Client View controls connected to the existing shared portal state so either control immediately updates the other.
- In Client View, remove the budget allocation and committed-percentage section entirely.
- Show `MSRP` as the price heading, display one retail price per item, and change the footer to `TOTAL ESTIMATE` using the retail total.
- In studio mode, retain the trade heading, discounted price, retail comparison, trade total, and internal budget section.
- Widen the lead-time track and add separation before prices so week ranges remain fully visible without overlap.

## Verification
- Test the authenticated Project Studio at 1280×1800 and the current 1350px desktop width.
- Toggle Client View from both the header and ledger, confirming synchronized switch state, privacy masking, retail totals, restored studio data, and no console errors.
- Check the ledger visually for lead-time clipping and price overlap.

## Technical Details
The page will continue using the existing shared trade-price/client-safe store; no quote, order, or checkout data will be changed.
