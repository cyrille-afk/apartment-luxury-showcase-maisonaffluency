# Top-Down Ceiling Proforma Ledger

## Build
- Add project-level ceiling-ledger defaults: enabled state, target ceiling, client markup, trade discount, and currency.
- Add quote-level override fields so each proforma can inherit or override its linked project's settings.
- Add quote controls for selecting itemized versus target-ceiling mode and editing the effective values.
- In target-ceiling mode, replace only the itemized product grid/totals with a `TARGET CEILING BUDGET SUMMARY` ledger.

## Calculation
- `Max Allowed Designer Cost = Target Client Ceiling Budget / (1 + Client Markup / 100)`
- `Designer Net Profit Margin = Target Client Ceiling Budget - Max Allowed Designer Cost`
- `Trade Sourcing Markdown = Max Allowed Designer Cost × Trade Discount / 100`
- `Net Purchasing Sourcing Budget = Max Allowed Designer Cost × (1 - Trade Discount / 100)`
- Print every figure right-aligned with two decimal places; label the active tier beside its discount when available.

## Preserve
- Keep the verified corporate header, issue/date details, client block, 60% deposit / 40% balance schedule, payment terms, and Option A / Option B bank-transfer tables.
- Keep itemized proformas unchanged when ceiling mode is off.
- Keep page sections together with explicit page-break guards.

## Verification and release
- Add calculation and PDF-content regression coverage, including the €50,000 example.
- Render the generated PDF to images and inspect every page for clipping, overlap, alignment, spacing, and footer/table breaks; fix and re-check any issue found.
- Run the project checks, publish the update, and verify the live result.

## Technical details
- Store money as integer minor units and percentages as numeric percentages.
- Resolve quote overrides first, then linked-project defaults.
- Extend the shared quote/proforma PDF arguments so invoice specialization retains the selected ledger unchanged.
