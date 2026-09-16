# Onboarding Currency Automation and Dashboard Tier Visibility

## Goal
Automatically suggest a client's default currency from their billing country, while preserving manual overrides, and show the signed-in trade member's active tier in the Curated Showroom welcome area.

## Implementation

### Client currency automation
- Reuse the existing supported country-to-currency mapping so client records follow the same regional preferences as the wider trade workspace (including United States → USD and Singapore → SGD).
- When a country is entered or selected for a new client, immediately populate Default currency.
- Allow the user to edit the suggested currency; once manually changed, later typing in the form will not overwrite that choice.
- For existing client records, preserve a saved default currency while editing. If an existing record has no currency, derive it from the saved country before persistence.
- Keep the current client table structure because `billing_country` and `default_currency` already exist.

### Dashboard tier line
- Read the logged-in user's live tier from the same source used by trade pricing.
- Replace the generic dashboard subtitle with `COMPANY NAME • TIER PARTNER` directly below the welcome heading.
- Keep the treatment minimal: tracked uppercase type using the existing muted semantic color, with no badge or card.

## Verification
- Check new-client country entry updates the currency immediately for United States and Singapore.
- Check a manual currency change remains intact afterward.
- Check editing an existing client preserves its saved currency.
- Verify the Curated Showroom dashboard shows the authenticated user's company and live tier at desktop and mobile widths.
- Run the focused TypeScript check and browser verification without changing the checkout funnel.
