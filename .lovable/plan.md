# Multi-browser cart persistence test

## Goal
Add reliable Chromium and WebKit coverage for cart deletion and cross-page basket recovery under simulated latency.

## Implementation
- Add a focused Playwright test using the existing local preview rather than production.
- Seed the real versioned cart and secure-basket envelopes, including Switzerland/CHF metadata.
- Simulate latency with supported request routing rather than the unavailable `page.emulateNetworkConditions` API.
- Verify removal updates the page and all persistent basket copies without mutating the original state.
- Verify WebKit navigation restores the item and Switzerland/CHF metadata.
- Add WebKit as a targeted Playwright project if its browser is available in the existing test environment.

## Validation
- Run the new test in desktop Chromium and WebKit.
- Keep existing unit persistence tests passing.
