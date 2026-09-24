# Single-page Trade Program application

## Scope
- Replace the three-screen application wizard with one vertical form containing email, company, website/Instagram, optional registration/tax ID, and optional credential upload.
- Keep the existing success confirmation, file safeguards, Turnstile verification, and application notifications.
- Match the requested uniform field heights, transparent bordered inputs, uppercase tracked placeholders, and charcoal submit button.
- Preserve the current desktop split with the dining-room image and adapt the form cleanly for mobile.

## Submission flow
- Submit the complete application once after Turnstile succeeds.
- Update the Trade Program submission function to validate Turnstile before any application record is written, then save all fields in one operation and trigger the existing alerts and analysis.
- Remove the step number, Continue actions, intermediate saves, and wizard state from the page.
- Keep menu navigation reset behavior for clearing the completed confirmation and form data.

## Verification
- Check the full form and success state in the live preview at desktop and mobile widths.
- Confirm field order, exact labels and placeholder, 48px controls, Turnstile placement, and no browser errors.
- Confirm incomplete or unverified submissions cannot be sent.
