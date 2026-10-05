# Configurable proforma formatting

## Scope
- Add studio-wide PDF defaults for locale/date formatting, with UK, US, Singapore, and ISO presets.
- Add per-proforma overrides in the quote editor; “Studio default” remains available.
- Keep all currencies at exactly two decimal places and use consistent, unambiguous symbols/codes across screen previews and PDFs.

## Implementation
- Create one shared formatting module for money, currency symbols, dates, defaults, and preset labels.
- Persist studio defaults on the studio record and quote overrides on the quote record through a focused database migration with existing access controls preserved.
- Add the studio controls to Studio Settings and per-document controls beside the proforma ledger settings.
- Route quote PDFs, invoice variants, bank-transfer proformas, and the live Target Ceiling preview through the shared formatter.
- Keep existing accounting calculations, headers, payment splits, and wire instructions unchanged.

## Verification
- Add focused formatter tests for every locale preset, currencies including JPY, fixed two-decimal precision, and date output.
- Run the project checks and inspect the generated PDFs visually for clipping, alignment, symbols, dates, and page breaks.
- Compare the live Target Ceiling summary against its downloaded PDF, then publish the update.
